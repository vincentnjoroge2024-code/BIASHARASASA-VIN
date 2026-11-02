import http.server
import socketserver
import urllib.parse

# ==================== CONFIGURATION ====================
# Point this to your main app's actual URL or server IP & port
MAIN_APP_URL = "http://192.168.1.50:5000"  
# Port that this standalone onboarding helper will run on
PORT = 8080                                  
# ========================================================

class OnboardingHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        
        if parsed_path.path == '/':
            # Capture client IP address from connection
            client_ip = self.client_address[0]
            
            html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Application Onboarding Portal</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #f8f9fa;
            color: #333;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }}
        .card {{
            background: #ffffff;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            text-align: center;
            max-width: 400px;
            width: 100%;
        }}
        h2 {{ margin-top: 0; color: #1a1a1a; }}
        p {{ color: #666; font-size: 14px; line-height: 1.5; }}
        .ip-badge {{
            background: #e9ecef;
            padding: 6px 12px;
            border-radius: 6px;
            font-family: monospace;
            font-weight: bold;
            color: #495057;
            display: inline-block;
            margin: 10px 0 20px 0;
        }}
        .btn {{
            background-color: #2563eb;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            display: inline-block;
            transition: background 0.2s;
        }}
        .btn:hover {{ background-color: #1d4ed8; }}
    </style>
</head>
<body>
    <div class="card">
        <h2>Client Onboarding</h2>
        <p>Your IP address has been verified:</p>
        <div class="ip-badge">{client_ip}</div>
        <p>Click below to download your desktop launcher shortcut.</p>
        <br>
        <a href="/download" class="btn">Download Desktop Shortcut</a>
    </div>
</body>
</html>"""
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(html.encode('utf-8'))
            
        elif parsed_path.path == '/download':
            user_agent = self.headers.get('User-Agent', '').lower()
            
            # Generate OS-specific shortcut file
            if 'windows' in user_agent:
                content = f"[InternetShortcut]\nURL={MAIN_APP_URL}\n".encode('utf-8')
                filename = "Launch_App.url"
                content_type = "application/x-ms-shortcut"
            elif 'macintosh' in user_agent or 'mac os' in user_agent:
                content = (
                    '<?xml version="1.0" encoding="UTF-8"?>\n'
                    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n'
                    '<plist version="1.0">\n<dict>\n'
                    f'<key>URL</key>\n<string>{MAIN_APP_URL}</string>\n'
                    '</dict>\n</plist>'
                ).encode('utf-8')
                filename = "Launch_App.webloc"
                content_type = "application/x-web-archive"
            else:
                content = (
                    "[Desktop Entry]\n"
                    "Type=Application\n"
                    "Name=App Shortcut\n"
                    f"Exec=xdg-open {MAIN_APP_URL}\n"
                    "Terminal=false\n"
                ).encode('utf-8')
                filename = "Launch_App.desktop"
                content_type = "application/x-desktop"
            
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Disposition", f"attachment; filename={filename}")
            self.end_headers()
            self.wfile.write(content)
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")

if __name__ == '__main__':
    with socketserver.TCPServer(("0.0.0.0", PORT), OnboardingHandler) as httpd:
        print(f"[*] Standalone Onboarding Server running on port {PORT}")
        print(f"[*] Shortcuts will point to main app at: {MAIN_APP_URL}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[*] Shutting down server...")
