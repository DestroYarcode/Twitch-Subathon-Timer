"""
Subathon Timer - Python Sync Server
Mit Queue-System fuer hohe Last und Goal-Datum
"""

import http.server
import json
import os
import time
import threading
from urllib.parse import urlparse
from collections import deque
from datetime import datetime

PORT = 8080
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'timer-data.json')

# Timer Daten
timer_data = {
    'totalSeconds': 0,
    'isRunning': False,
    'totalSubs': 0,
    'totalBits': 0,
    'totalTimeAdded': 0,
    'lastUpdate': int(time.time() * 1000),
    'goalTimestamp': None,  # Unix timestamp in ms - max Enddatum
    'goalReached': False,
    'startTimestamp': None,  # Unix timestamp in ms - Subathon Start
    'config': {
        'channel': '',
        'timePerSub': 60,
        'timePerSubTier2': 120,
        'timePerSubTier3': 300,
        'timePerGiftSub': 60,
        'bitsPerMinute': 500  # 500 Bits = 60 Sekunden
    },
    'subList': []  # Liste aller Subs mit Details
}

# Thread-sichere Queue fuer eingehende Zeit-Additionen
time_queue = deque()
queue_lock = threading.Lock()
data_lock = threading.Lock()

# Stats
stats = {
    'total_requests': 0,
    'queued_additions': 0,
    'processed_additions': 0,
    'rejected_by_goal': 0
}

def load_data():
    global timer_data
    try:
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                saved = json.load(f)
                # Zeit korrigieren wenn Timer lief
                if saved.get('isRunning') and saved.get('lastUpdate'):
                    elapsed = int((time.time() * 1000 - saved['lastUpdate']) / 1000)
                    saved['totalSeconds'] = max(0, saved['totalSeconds'] - elapsed)
                    if saved['totalSeconds'] == 0:
                        saved['isRunning'] = False
                timer_data.update(saved)
                print('[OK] Daten geladen')
                if timer_data.get('goalTimestamp'):
                    goal_dt = datetime.fromtimestamp(timer_data['goalTimestamp'] / 1000)
                    print(f'[GOAL] Ziel: {goal_dt.strftime("%d.%m.%Y %H:%M")}')
    except Exception as e:
        print(f'Fehler beim Laden: {e}')

def save_data():
    timer_data['lastUpdate'] = int(time.time() * 1000)
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(timer_data, f, indent=2)
    except Exception as e:
        print(f'Fehler beim Speichern: {e}')

def get_max_addable_seconds():
    """Berechnet wie viele Sekunden noch hinzugefuegt werden koennen bis zum Goal"""
    if not timer_data.get('goalTimestamp'):
        return 999999999  # Kein Limit (aber kein Infinity wegen JSON)
    
    now_ms = int(time.time() * 1000)
    goal_ms = timer_data['goalTimestamp']
    
    # Wie viele Sekunden sind es noch bis zum Goal?
    seconds_until_goal = (goal_ms - now_ms) / 1000
    
    # Minus die aktuelle Timer-Zeit
    max_addable = seconds_until_goal - timer_data['totalSeconds']
    
    return max(0, int(max_addable))

def add_time_internal(seconds, reason='manual', is_sub=False, sub_info=None):
    """Interne Funktion zum Zeit hinzufuegen mit Goal-Check"""
    global timer_data, stats
    
    max_addable = get_max_addable_seconds()
    
    if max_addable <= 0:
        # Goal bereits erreicht
        timer_data['goalReached'] = True
        stats['rejected_by_goal'] += 1
        print(f'[GOAL] Zeit abgelehnt: +{seconds}s - Goal erreicht!')
        return 0
    
    # Begrenzen auf max moegliche Zeit
    actual_seconds = min(seconds, int(max_addable))
    
    if actual_seconds < seconds:
        print(f'[GOAL] Zeit begrenzt: +{actual_seconds}s statt +{seconds}s')
        timer_data['goalReached'] = True
    
    timer_data['totalSeconds'] += actual_seconds
    timer_data['totalTimeAdded'] += actual_seconds
    
    if is_sub:
        # Bei Gift Bombs die Anzahl zählen, sonst 1
        gift_count = sub_info.get('giftCount', 0) if sub_info else 0
        sub_count = gift_count if gift_count > 0 else 1
        timer_data['totalSubs'] += sub_count
    
    # Sub/Bits-Info zur Liste hinzufuegen
    if sub_info:
        sub_entry = {
            'timestamp': int(time.time() * 1000),
            'username': sub_info.get('username', 'Unbekannt'),
            'type': sub_info.get('type', 'sub'),  # sub, resub, gift, gifted, prime, bits
            'tier': sub_info.get('tier', 1),
            'giftCount': sub_info.get('giftCount', 0),
            'recipient': sub_info.get('recipient', ''),
            'isPrime': sub_info.get('isPrime', False),
            'months': sub_info.get('months', 0),
            'bits': sub_info.get('bits', 0),  # Für Bits-Einträge
            'timeAdded': actual_seconds
        }
        timer_data['subList'].insert(0, sub_entry)  # Neueste zuerst
        # Max 100 Eintraege behalten
        if len(timer_data['subList']) > 100:
            timer_data['subList'] = timer_data['subList'][:100]
    
    stats['processed_additions'] += 1
    
    return actual_seconds

def process_queue():
    """Verarbeitet die Queue kontinuierlich"""
    global stats
    while True:
        time.sleep(0.01)  # 10ms - schnelle Verarbeitung
        
        with queue_lock:
            if not time_queue:
                continue
            item = time_queue.popleft()
        
        with data_lock:
            sub_info = item.get('sub_info') or {}
            added = add_time_internal(
                item['seconds'], 
                item.get('reason', 'manual'),
                item.get('is_sub', False),
                item.get('sub_info')
            )
            if added > 0:
                username = sub_info.get('username', 'manual') if sub_info else 'manual'
                gift_count = sub_info.get('giftCount', 0) if sub_info else 0
                sub_str = f' | +{gift_count} Subs' if gift_count > 0 else (' | +1 Sub' if item.get('is_sub') else '')
                print(f'[+] +{added}s ({username}){sub_str} | Queue: {len(time_queue)} | Total: {timer_data["totalSeconds"]}s')
            
            # Speichern alle 10 Verarbeitungen oder wenn Queue leer
            if stats['processed_additions'] % 10 == 0 or len(time_queue) == 0:
                save_data()

def timer_tick():
    """Timer countdown"""
    while True:
        time.sleep(1)
        with data_lock:
            if timer_data['isRunning'] and timer_data['totalSeconds'] > 0:
                timer_data['totalSeconds'] -= 1
                if timer_data['totalSeconds'] <= 0:
                    timer_data['isRunning'] = False
                    print('[!] Timer abgelaufen!')
                # Alle 10 Sekunden speichern
                if timer_data['totalSeconds'] % 10 == 0:
                    save_data()

class TimerHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        return json.loads(self.rfile.read(length).decode('utf-8')) if length else {}

    def do_GET(self):
        global stats
        path = urlparse(self.path).path
        stats['total_requests'] += 1
        
        if path == '/api/timer':
            with data_lock:
                response = dict(timer_data)
                response['queueSize'] = len(time_queue)
                response['stats'] = stats
                response['maxAddable'] = get_max_addable_seconds()
                self.send_json(response)
            return
        
        if path == '/':
            self.path = '/control.html'
        
        return super().do_GET()

    def do_POST(self):
        global timer_data, stats
        path = urlparse(self.path).path
        stats['total_requests'] += 1

        if path == '/api/timer':
            with data_lock:
                update = self.read_body()
                # Config, Goal und Start separat behandeln
                if 'config' in update:
                    timer_data['config'].update(update['config'])
                    print(f'[CONFIG] Zeiten: T1={timer_data["config"]["timePerSub"]}s, T2={timer_data["config"]["timePerSubTier2"]}s, T3={timer_data["config"]["timePerSubTier3"]}s')
                if 'goalTimestamp' in update:
                    timer_data['goalTimestamp'] = update['goalTimestamp']
                    timer_data['goalReached'] = False
                    if update['goalTimestamp']:
                        goal_dt = datetime.fromtimestamp(update['goalTimestamp'] / 1000)
                        print(f'[GOAL] Neues Ziel: {goal_dt.strftime("%d.%m.%Y %H:%M")}')
                    else:
                        print('[GOAL] Ziel entfernt')
                if 'startTimestamp' in update:
                    timer_data['startTimestamp'] = update['startTimestamp']
                    if update['startTimestamp']:
                        start_dt = datetime.fromtimestamp(update['startTimestamp'] / 1000)
                        print(f'[START] Subathon Start: {start_dt.strftime("%d.%m.%Y %H:%M")}')
                    else:
                        print('[START] Startdatum entfernt')
                save_data()
                print(f'[SAVE] Config aktualisiert')
                self.send_json({'success': True, 'data': timer_data})
            return

        if path == '/api/addtime':
            body = self.read_body()
            seconds = body.get('seconds', 0)
            reason = body.get('reason', 'manual')
            is_sub = reason == 'sub'
            sub_info = body.get('subInfo')
            
            # In Queue einreihen - thread-sicher und schnell
            with queue_lock:
                time_queue.append({
                    'seconds': seconds,
                    'reason': reason,
                    'is_sub': is_sub,
                    'sub_info': sub_info,
                    'timestamp': time.time()
                })
                stats['queued_additions'] += 1
            
            self.send_json({
                'success': True, 
                'queued': True,
                'queueSize': len(time_queue)
            })
            return

        if path == '/api/start':
            with data_lock:
                timer_data['isRunning'] = True
                save_data()
                print('[>] Timer gestartet')
                self.send_json({'success': True})
            return

        if path == '/api/pause':
            with data_lock:
                timer_data['isRunning'] = False
                save_data()
                print('[||] Timer pausiert')
                self.send_json({'success': True})
            return

        if path == '/api/reset':
            with data_lock:
                timer_data['totalSeconds'] = 0
                timer_data['isRunning'] = False
                timer_data['totalSubs'] = 0
                timer_data['totalTimeAdded'] = 0
                timer_data['goalReached'] = False
                save_data()
                print('[RESET] Timer zurueckgesetzt')
                self.send_json({'success': True})
            return

        if path == '/api/fullreset':
            with data_lock:
                timer_data['totalSeconds'] = 0
                timer_data['isRunning'] = False
                timer_data['totalSubs'] = 0
                timer_data['totalBits'] = 0
                timer_data['totalTimeAdded'] = 0
                timer_data['goalTimestamp'] = None
                timer_data['goalReached'] = False
                timer_data['startTimestamp'] = None
                timer_data['subList'] = []
                timer_data['config'] = {
                    'channel': '',
                    'timePerSub': 60,
                    'timePerSubTier2': 120,
                    'timePerSubTier3': 300,
                    'timePerGiftSub': 60,
                    'bitsPerMinute': 500
                }
                # Stats zuruecksetzen
                stats['total_requests'] = 0
                stats['queued_additions'] = 0
                stats['processed_additions'] = 0
                stats['rejected_by_goal'] = 0
                save_data()
                print('[FULL RESET] Alles zurueckgesetzt!')
                self.send_json({'success': True})
            return

        if path == '/api/settime':
            with data_lock:
                body = self.read_body()
                requested = body.get('seconds', 0)
                
                # Goal-Check
                if timer_data.get('goalTimestamp'):
                    now_ms = int(time.time() * 1000)
                    max_seconds = (timer_data['goalTimestamp'] - now_ms) / 1000
                    if requested > max_seconds:
                        requested = int(max_seconds)
                        timer_data['goalReached'] = True
                        print(f'[GOAL] Zeit auf {requested}s begrenzt')
                
                timer_data['totalSeconds'] = requested
                save_data()
                print(f'[TIME] Zeit gesetzt: {timer_data["totalSeconds"]}s')
                self.send_json({'success': True, 'data': timer_data})
            return

        if path == '/api/setgoal':
            with data_lock:
                body = self.read_body()
                timer_data['goalTimestamp'] = body.get('timestamp')
                timer_data['goalReached'] = False
                save_data()
                if timer_data['goalTimestamp']:
                    goal_dt = datetime.fromtimestamp(timer_data['goalTimestamp'] / 1000)
                    print(f'[GOAL] Ziel gesetzt: {goal_dt.strftime("%d.%m.%Y %H:%M")}')
                else:
                    print('[GOAL] Ziel entfernt')
                self.send_json({'success': True, 'data': timer_data})
            return

        if path == '/api/addbits':
            with data_lock:
                body = self.read_body()
                bits = body.get('bits', 0)
                timer_data['totalBits'] = timer_data.get('totalBits', 0) + bits
                save_data()
                print(f'[BITS] +{bits} Bits (Total: {timer_data["totalBits"]})')
                self.send_json({'success': True, 'totalBits': timer_data['totalBits']})
            return

        if path == '/api/resetlist':
            with data_lock:
                timer_data['subList'] = []
                timer_data['totalSubs'] = 0
                timer_data['totalTimeAdded'] = 0
                timer_data['totalBits'] = 0
                save_data()
                print('[RESET] Sub-Liste, Subs, Bits und hinzugefügte Zeit zurückgesetzt')
                self.send_json({'success': True})
            return

        self.send_json({'error': 'Not found'}, 404)

    def log_message(self, format, *args):
        pass  # Kein Logging fuer normale Requests

if __name__ == '__main__':
    load_data()
    
    # Queue-Processor Thread
    queue_thread = threading.Thread(target=process_queue, daemon=True)
    queue_thread.start()
    
    # Timer Thread
    timer_thread = threading.Thread(target=timer_tick, daemon=True)
    timer_thread.start()
    
    print('')
    print('=' * 55)
    print('   SUBATHON TIMER SERVER - HIGH PERFORMANCE')
    print('=' * 55)
    print('')
    print(f'   Kontrollzentrum: http://localhost:{PORT}/')
    print(f'   Timer (OBS):     http://localhost:{PORT}/timer.html')
    print('')
    print(f'   Kanal: {timer_data["config"].get("channel") or "Nicht konfiguriert"}')
    if timer_data.get('goalTimestamp'):
        goal_dt = datetime.fromtimestamp(timer_data['goalTimestamp'] / 1000)
        print(f'   Goal:  {goal_dt.strftime("%d.%m.%Y %H:%M")}')
    print('')
    print('   [!] Queue-System aktiv - verarbeitet 100 Subs/Sek')
    print('')
    print('=' * 55)
    print('')
    
    server = http.server.ThreadingHTTPServer(('', PORT), TimerHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServer beendet')
        save_data()
