#!/usr/bin/env swift
/**
 * 零安装 HTML→PNG 渲染器（系统 WebKit，不裁切、无浏览器界面）。
 *
 * 用法（项目根目录）：
 *   swift marketing/render.swift <html文件名> <输出文件名> <宽> <高>
 * 例：
 *   swift marketing/render.swift poster.html        poster.png        1080 1920
 *   swift marketing/render.swift poster-square.html poster-square.png 1080 1080
 *
 * 说明：直接用 WKWebView 离屏加载、等布局完成后把整个 frame 画进位图。
 * 不用 qlmanage（强制正方形缩略图会切竖图），不用截图（带浏览器窗口）。
 */
import AppKit
import WebKit

let args = CommandLine.arguments
// args[0]=脚本名，后面跟 html/out/宽/高 共 4 个，合计至少 5 个
if args.count < 5 {
    FileHandle.standardError.write(
        "用法: swift render.swift <html> <out.png> <宽> <高>\n".data(using: .utf8)!)
    exit(2)
}
let scriptDir = URL(fileURLWithPath: args[0]).deletingLastPathComponent()
let root = scriptDir.deletingLastPathComponent()           // 项目根（海报用 ../h5 相对资源）
let htmlURL = scriptDir.appendingPathComponent(args[1])
let outURL = scriptDir.appendingPathComponent(args[2])
let W = Int(args[3]) ?? 1080
let H = Int(args[4]) ?? 1920

let app = NSApplication.shared
app.setActivationPolicy(.accessory)

let rect = NSRect(x: 0, y: 0, width: W, height: H)
let window = NSWindow(contentRect: rect, styleMask: [], backing: .buffered, defer: false)
let webview = WKWebView(frame: rect, configuration: WKWebViewConfiguration())
window.contentView = webview

final class Done: NSObject, WKNavigationDelegate {
    var finished = false
    var failed = false
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.30) { self.finished = true }
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        FileHandle.standardError.write("加载失败: \(error)\n".data(using: .utf8)!)
        self.failed = true
    }
}
let done = Done()
webview.navigationDelegate = done
webview.loadFileURL(htmlURL, allowingReadAccessTo: root)

let deadline = Date(timeIntervalSinceNow: 20)
while !done.finished && !done.failed && Date() < deadline {
    app.nextEvent(matching: .any, until: Date(timeIntervalSinceNow: 0.05),
                  inMode: .default, dequeue: true)
}
if done.failed || !done.finished {
    FileHandle.standardError.write("海报加载超时或失败\n".data(using: .utf8)!)
    exit(1)
}

webview.layoutSubtreeIfNeeded()
guard let rep = webview.bitmapImageRepForCachingDisplay(in: rect) else { exit(1) }
webview.cacheDisplay(in: rect, to: rep)
guard let png = rep.representation(using: .png, properties: [:]) else { exit(1) }
try? png.write(to: outURL)
print("✓ \(outURL.path)  (\(W)×\(H))")
