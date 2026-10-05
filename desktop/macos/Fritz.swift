import AppKit
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var server: Process?
    private var inputPipe: Pipe?
    private var outputPipe: Pipe?
    private var origin: URL?
    private var ready = false
    private var terminating = false
    private var smokeFinished = false
    private var recoveringSession = false
    private var sessionRefresh: DispatchWorkItem?
    private var smokeRecoveredSession = false
    private var locationObservation: NSKeyValueObservation?
    private var pendingSmokeReport: [String: Any]?
    private struct DownloadDestination {
        let temporary: URL
        let final: URL
    }
    private var downloadDestinations: [ObjectIdentifier: DownloadDestination] = [:]

    func applicationDidFinishLaunching(_ notification: Notification) {
        makeMenu()
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        locationObservation = webView.observe(\.url, options: [.new]) { [weak self] _, change in
            guard let self, self.ready, let url = change.newValue ?? nil,
                  self.isLocal(url), ["/login", "/login/"].contains(url.path) else { return }
            self.recoverLocalSession()
        }
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1180, height: 820),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "Fritz"
        window.minSize = NSSize(width: 390, height: 640)
        window.contentView = webView
        window.setFrameAutosaveName("FritzMainWindow")
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        showStatus("Fritz", detail: "Připravuji tvoje lekce…")
        startServer()
    }

    private func makeMenu() {
        let menu = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About Fritz", action: #selector(showAbout), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide Fritz", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Quit Fritz", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        menu.addItem(appItem)
        let edit = NSMenuItem(title: "Edit", action: nil, keyEquivalent: "")
        let editMenu = NSMenu(title: "Edit")
        for (title, selector, key) in [
            ("Undo", "undo:", "z"), ("Redo", "redo:", "Z"),
            ("Cut", "cut:", "x"), ("Copy", "copy:", "c"),
            ("Paste", "paste:", "v"), ("Select All", "selectAll:", "a")
        ] {
            editMenu.addItem(withTitle: title, action: Selector(selector), keyEquivalent: key)
        }
        edit.submenu = editMenu
        menu.addItem(edit)
        let view = NSMenuItem(title: "View", action: nil, keyEquivalent: "")
        let viewMenu = NSMenu(title: "View")
        viewMenu.addItem(withTitle: "Reload", action: #selector(reload), keyEquivalent: "r")
        viewMenu.addItem(withTitle: "Back", action: #selector(goBack), keyEquivalent: "[")
        view.submenu = viewMenu
        menu.addItem(view)
        NSApp.mainMenu = menu
    }

    @objc private func showAbout() {
        NSApp.orderFrontStandardAboutPanel(options: [
            .applicationName: "Fritz",
            .applicationVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "",
            .credits: NSAttributedString(string: "German, one useful lesson at a time.\nLearning progress stays on this Mac."),
        ])
    }
    @objc private func reload() { if ready { webView.reload() } }
    @objc private func goBack() { if webView.canGoBack { webView.goBack() } }

    private func showStatus(_ title: String, detail: String) {
        func escape(_ value: String) -> String {
            value.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: ">", with: "&gt;")
        }
        webView.loadHTMLString("""
        <!doctype html><html lang="cs"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fritz</title>
        <style>body{margin:0;min-height:100vh;display:grid;place-content:center;background:#fbf8f1;color:#263b32;font:18px -apple-system,sans-serif;padding:0 32px;box-sizing:border-box}h1{font:56px Georgia,serif;margin:0 0 16px}p{max-width:520px;line-height:1.6}</style>
        <h1>\(escape(title))</h1><p>\(escape(detail))</p></html>
        """, baseURL: nil)
    }

    private func startServer() {
        guard let resources = Bundle.main.resourceURL else { return }
        let process = Process()
        let input = Pipe()
        let output = Pipe()
        process.executableURL = resources.appendingPathComponent("node")
        process.arguments = [resources.appendingPathComponent("bootstrap.mjs").path]
        process.currentDirectoryURL = resources
        var environment = ProcessInfo.processInfo.environment
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Fritz", isDirectory: true)
        environment["FRITZ_DESKTOP_DATA_DIR"] = environment["FRITZ_DESKTOP_DATA_DIR"] ?? support.path
        environment.removeValue(forKey: "NODE_OPTIONS")
        environment.removeValue(forKey: "NODE_PATH")
        process.environment = environment
        process.standardInput = input
        process.standardOutput = output
        // The helper's stdout contains a session credential and is only read
        // by this process. Neither stdout nor server diagnostics go to logs.
        process.standardError = FileHandle.nullDevice
        process.terminationHandler = { [weak self] _ in
            DispatchQueue.main.async {
                guard let self, !self.terminating else { return }
                self.ready = false
                self.showStatus("Fritz se zastavil", detail: "Uložený pokrok zůstává na tomto Macu. Ukonči aplikaci a otevři ji znovu.")
                self.writeSmokeReport(["ok": false, "error": "server-exited"])
            }
        }
        server = process
        inputPipe = input
        outputPipe = output
        do {
            try process.run()
        } catch {
            showStatus("Fritz nejde spustit", detail: "Aplikaci přesuň celou do složky Aplikace a zkus ji otevřít znovu.")
            writeSmokeReport(["ok": false, "error": "launch-failed"])
            return
        }
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            var buffer = Data()
            while buffer.count < 16_384 {
                let data = output.fileHandleForReading.availableData
                if data.isEmpty { return }
                buffer.append(data)
                while let newline = buffer.firstIndex(of: 10) {
                    let line = buffer.prefix(upTo: newline)
                    let payload = try? JSONSerialization.jsonObject(with: line) as? [String: Any]
                    buffer.removeSubrange(...newline)
                    guard let payload else { return }
                    DispatchQueue.main.async { self?.handleReady(payload) }
                }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 25) { [weak self] in
            guard let self, !self.ready, !self.terminating else { return }
            self.showStatus("Spuštění trvá příliš dlouho", detail: "Ukonči Fritz a otevři ho znovu. Uložený pokrok zůstane zachovaný.")
            self.writeSmokeReport(["ok": false, "error": "startup-timeout"])
        }
    }

    private func handleReady(_ payload: [String: Any]) {
        let shouldNavigate = !ready || recoveringSession
        recoveringSession = false
        guard payload["type"] as? String == "ready",
              let address = payload["origin"] as? String, let url = URL(string: address),
              url.scheme == "http", url.host == "127.0.0.1", let port = url.port, port >= 1024,
              let token = payload["token"] as? String,
              let expiry = payload["expiresAt"] as? Double else {
            showStatus("Fritz nejde spustit", detail: payload["message"] as? String ?? "Zkus aplikaci zavřít a znovu otevřít.")
            writeSmokeReport(["ok": false, "error": "bootstrap-failed"])
            return
        }
        origin = url
        sessionRefresh?.cancel()
        let refresh = DispatchWorkItem { [weak self] in
            guard let self, !self.terminating else { return }
            do { try self.inputPipe?.fileHandleForWriting.write(contentsOf: Data("authenticate\n".utf8)) }
            catch { self.recoverLocalSession() }
        }
        sessionRefresh = refresh
        DispatchQueue.main.asyncAfter(deadline: .now() + max(1, expiry / 1000 - Date().timeIntervalSince1970 - 3600), execute: refresh)
        let cookieProperties: [HTTPCookiePropertyKey: Any] = [
            .name: "fritz_session", .value: token, .domain: "127.0.0.1", .path: "/",
            .expires: Date(timeIntervalSince1970: expiry / 1000),
            HTTPCookiePropertyKey("HttpOnly"): "TRUE",
            HTTPCookiePropertyKey("SameSite"): "Strict",
        ]
        guard let cookie = HTTPCookie(properties: cookieProperties) else { return }
        webView.configuration.websiteDataStore.httpCookieStore.setCookie(cookie) { [weak self] in
            guard let self else { return }
            self.ready = true
            if shouldNavigate { self.webView.load(URLRequest(url: url)) }
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) {
        terminating = true
        sessionRefresh?.cancel()
        for destination in downloadDestinations.values { try? FileManager.default.removeItem(at: destination.temporary) }
        try? inputPipe?.fileHandleForWriting.close()
        if server?.isRunning == true { server?.terminate() }
    }

    private func isLocal(_ url: URL) -> Bool {
        guard let origin else { return false }
        return url.scheme == origin.scheme && url.host == origin.host && url.port == origin.port
    }

    private func recoverLocalSession() {
        guard !recoveringSession else { return }
        recoveringSession = true
        do { try inputPipe?.fileHandleForWriting.write(contentsOf: Data("authenticate\n".utf8)) }
        catch {
            recoveringSession = false
            showStatus("Profil nejde otevřít", detail: "Ukonči Fritz a zkus ho otevřít znovu.")
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "about" { decisionHandler(.allow); return }
        if isLocal(url) && ["/login", "/login/"].contains(url.path) {
            decisionHandler(.cancel)
            recoverLocalSession()
            return
        }
        if isLocal(url) || url.scheme == "blob" {
            decisionHandler(navigationAction.shouldPerformDownload ? .download : .allow)
        } else {
            if ["https", "http", "mailto"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            if isLocal(url) { webView.load(navigationAction.request) }
            else if ["https", "http", "mailto"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
        }
        return nil
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.beginSheetModal(for: window) { response in completionHandler(response == .OK ? panel.urls : nil) }
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = "Fritz"
        alert.informativeText = message
        alert.addButton(withTitle: "OK")
        alert.beginSheetModal(for: window) { _ in completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = "Fritz"
        alert.informativeText = message
        alert.addButton(withTitle: "Potvrdit")
        alert.addButton(withTitle: "Zrušit")
        alert.beginSheetModal(for: window) { response in completionHandler(response == .alertFirstButtonReturn) }
    }

    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(origin.host == "127.0.0.1" && origin.port == self.origin?.port ? .prompt : .deny)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        if let reportPath = ProcessInfo.processInfo.environment["FRITZ_DESKTOP_SMOKE_REPORT"],
           pendingSmokeReport != nil, suggestedFilename == "fritz-smoke.json" {
            completionHandler(prepareDownload(download, destination: URL(fileURLWithPath: reportPath + ".download.json")))
            return
        }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = URL(fileURLWithPath: suggestedFilename).lastPathComponent
        panel.beginSheetModal(for: window) { result in
            guard result == .OK, let url = panel.url else { completionHandler(nil); return }
            completionHandler(self.prepareDownload(download, destination: url))
        }
    }

    private func prepareDownload(_ download: WKDownload, destination: URL) -> URL {
        // WKDownload requires a nonexistent destination. Preserve an existing
        // backup until the new file has completely downloaded, then replace it
        // atomically on the same filesystem.
        let temporary = destination.deletingLastPathComponent()
            .appendingPathComponent(".fritz-export-\(UUID().uuidString).download")
        downloadDestinations[ObjectIdentifier(download)] = DownloadDestination(temporary: temporary, final: destination)
        return temporary
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        if let destination = downloadDestinations.removeValue(forKey: ObjectIdentifier(download)) {
            try? FileManager.default.removeItem(at: destination.temporary)
        }
        if (error as NSError).code == NSURLErrorCancelled { return }
        if pendingSmokeReport != nil {
            writeSmokeReport(["ok": false, "error": "blob-download-failed"])
            return
        }
        let alert = NSAlert()
        alert.messageText = "Soubor se nepodařilo uložit"
        alert.informativeText = "Zkus export znovu a vyber dostupnou složku."
        alert.beginSheetModal(for: window)
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let destination = downloadDestinations.removeValue(forKey: ObjectIdentifier(download)) else { return }
        do {
            if pendingSmokeReport != nil {
                let previous = try Data(contentsOf: destination.final)
                pendingSmokeReport?["previousBackupPreserved"] = String(data: previous, encoding: .utf8) == "previous-backup"
            }
            if FileManager.default.fileExists(atPath: destination.final.path) {
                _ = try FileManager.default.replaceItemAt(destination.final, withItemAt: destination.temporary)
            } else {
                try FileManager.default.moveItem(at: destination.temporary, to: destination.final)
            }
        } catch {
            try? FileManager.default.removeItem(at: destination.temporary)
            if pendingSmokeReport != nil {
                writeSmokeReport(["ok": false, "error": "export-replacement-failed"])
            } else {
                let alert = NSAlert()
                alert.messageText = "Soubor se nepodařilo uložit"
                alert.informativeText = "Předchozí záloha zůstala zachovaná. Zkus export uložit pod jiným názvem."
                alert.beginSheetModal(for: window)
            }
            return
        }
        if var report = pendingSmokeReport {
            report["downloaded"] = true
            pendingSmokeReport = nil
            writeSmokeReport(report)
        }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { if ready { webView.reload() } }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard ready, !smokeFinished,
              ProcessInfo.processInfo.environment["FRITZ_DESKTOP_SMOKE_REPORT"] != nil,
              let url = webView.url, isLocal(url) else { return }
        if !smokeRecoveredSession {
            smokeRecoveredSession = true
            webView.callAsyncJavaScript("""
                const response = await fetch('/api/auth/logout/', {method:'POST'});
                if (!response.ok) throw new Error('Synthetic session revocation failed');
                location.assign('/login/');
                """, arguments: [:], in: nil, in: .page) { [weak self] result in
                    if case .failure = result { self?.writeSmokeReport(["ok": false, "error": "native-session-recovery-failed"]) }
                }
            return
        }
        smokeFinished = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
            guard let self else { return }
            self.webView.callAsyncJavaScript("""
                const persisted=localStorage.getItem('fritz:desktop-smoke')==='ok';
                const db=await new Promise((resolve,reject)=>{
                  const request=indexedDB.open('fritz-desktop-smoke',1);
                  request.onupgradeneeded=()=>request.result.createObjectStore('progress');
                  request.onerror=()=>reject(request.error);
                  request.onsuccess=()=>resolve(request.result);
                });
                const indexedDbPersisted=await new Promise((resolve,reject)=>{
                  const request=db.transaction('progress').objectStore('progress').get('chapter');
                  request.onsuccess=()=>resolve(request.result===3);
                  request.onerror=()=>reject(request.error);
                });
                await new Promise((resolve,reject)=>{
                  const tx=db.transaction('progress','readwrite');
                  tx.objectStore('progress').put(3,'chapter');
                  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
                });
                db.close();localStorage.setItem('fritz:desktop-smoke','ok');
                return {title:document.title,path:location.pathname,persisted,indexedDbPersisted,
                  body:document.body.innerText.slice(0,200),httpOnly:!document.cookie.includes('fritz_session'),
                  logoutVisible:!!document.querySelector('.logout-link, button[aria-label="Odhlásit"]')};
                """, arguments: [:], in: nil, in: .page) { result in
                guard case .success(let value) = result, var report = value as? [String: Any] else {
                    self.writeSmokeReport(["ok": false, "error": "webkit-storage-failed"])
                    return
                }
                report["ok"] = report["path"] as? String != "/login/"
                report["origin"] = self.origin?.absoluteString
                self.pendingSmokeReport = report
                self.webView.evaluateJavaScript("""
                    const blob=new Blob([JSON.stringify({test:'fritz-desktop-export'})],{type:'application/json'});
                    const link=document.createElement('a');link.href=URL.createObjectURL(blob);
                    link.download='fritz-smoke.json';document.body.append(link);link.click();link.remove();
                    """, completionHandler: nil)
            }
        }
    }

    private func writeSmokeReport(_ report: [String: Any]) {
        guard let path = ProcessInfo.processInfo.environment["FRITZ_DESKTOP_SMOKE_REPORT"],
              let data = try? JSONSerialization.data(withJSONObject: report, options: [.sortedKeys]) else { return }
        try? data.write(to: URL(fileURLWithPath: path), options: .atomic)
        if ProcessInfo.processInfo.environment["FRITZ_DESKTOP_SMOKE_EXIT"] == "1" {
            // Exercise the normal Quit lifecycle so WebKit receives its
            // termination notification and flushes website data before exit.
            NSApp.terminate(nil)
        }
    }
}

let application = NSApplication.shared
let delegate = AppDelegate()
application.delegate = delegate
application.setActivationPolicy(.regular)
application.run()
