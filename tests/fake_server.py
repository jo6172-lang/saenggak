"""시험 전용 서버: 앱 파일을 내주고 /__fake/<사용자> 에 마인드맵을 메모리에 담는다."""
import json, sys, http.server, functools
DB = {}
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path.startswith('/__fake/'):
            u = self.path.split('/')[2]; body = json.dumps(DB.get(u, {})).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(body); return
        return super().do_GET()
    def do_POST(self):
        u = self.path.split('/')[2]; n = int(self.headers['Content-Length']); d = json.loads(self.rfile.read(n))
        cur = DB.setdefault(u, {}).get(d['id'], {}); cur.update(d); DB[u][d['id']] = cur
        self.send_response(200); self.end_headers(); self.wfile.write(b'{}')
root = sys.argv[1]; port = int(sys.argv[2])
http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(H, directory=root)).serve_forever()
