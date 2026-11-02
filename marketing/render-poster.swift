#!/usr/bin/env swift
/**
 * 零安装海报渲染器：用系统自带 WebKit（Safari 内核）把 poster.html
 * 整页渲染成精确 1080×1920 的 PNG，不裁切、无浏览器界面。
 *
 * 用法（项目根目录）：
 *   swift marketing/render-poster.swift
 * 输出：
 *   marketing/poster.png
 *
 * 为什么不用 qlmanage：它生成的是正方形缩略图，会把竖版海报的右侧和底部切掉。
 * 为什么不用截图：会带上浏览器窗口和空白。
 * 这里直接用 WKWebView 离屏加载、等布局完成后把整个 frame 画进位图，所见即整页。
 */
import AppKit
import WebKit

let dir = URL(fileURLWithPath: CommandLine.arguments[0])
    .deletingLastPathComponent()
let root = dir.deletingLastPathComponent()          // 项目根
let htmlURL = dir.appendingPathComponent("poster.html")
let outURL = dir.appendingPathComponent("poster.png")

let W = 1080
let H = 1920

let app = NSApplication.shared
app.setActivationPolicy(.accessory)

// 离屏窗口承载 WKWebView，frame 就是目标整页尺寸
let rect = NSRect(x: 0, y: 0, width: W, height: H)
let window = NSWindow(
    contentRect: rect,
    styleMask: [],
    backing: .buffered,
    defer: false
)
let config = WKWebViewConfiguration()
let webview = WKWebView(frame: rect, configuration: config)
window.contentView = webview

// 等待加载完成的信号
final class Done: NSObject, WKNavigationDelegate {
    var finished = false
    var failed = false
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // 再给字体/布局一帧时间，确保 settle
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.30) {
            self.finished = true
        }
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!,
                 withError error: Error) {
        FileHandle.standardError.write("加载失败: \(error)\n".data(using: .utf8)!)
        self.failed = true
    }
}
let done = Done()
webview.navigationDelegate = done
webview.loadFileURL(htmlURL, allowingReadAccessTo: root)

// 简单 RunLoop 等待
let deadline = Date(timeIntervalSinceNow: 20)
while !done.finished && !done.failed && Date() < deadline {
    app.nextEvent(matching: .any, until: Date(timeIntervalSinceNow: 0.05),
                  inMode: .default, dequeue: true)
}
if done.failed || !done.finished {
    FileHandle.standardError.write("海报加载超时或失败\n".data(using: .utf8)!)
    exit(1)
}

// 强制立即布局后，把整个 WebView 画进位图
webview.layoutSubtreeIfNeeded()
guard let rep = webview.bitmapImageRepForCachingDisplay(in: rect) else {
    FileHandle.standardError.write("无法创建位图\n".data(using: .utf8)!)
    exit(1)
}
webview.cacheDisplay(in: rect, to: rep)

// 输出 PNG
guard let tiff = rep.representation(using: .png, properties: [:]) else {
    FileHandle.standardError.write("PNG 编码失败\n".data(using: .utf8)!)
    exit(1)
}
try? tiff.write(to: outURL)
print("✓ \(outURL.path)  (\(W)×\(H))")
