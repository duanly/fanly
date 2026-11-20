#!/usr/bin/env swift
/**
 * 用系统 Vision 框架检测图片里的二维码并打印内容，验证海报出图后码仍可扫。
 * 用法：swift detect-qr.swift <图片路径> [更多图片...]
 */
import AppKit
import Vision

let paths = Array(CommandLine.arguments.dropFirst())
guard !paths.isEmpty else { fputs("用法: swift detect-qr.swift <img...>\n", stderr); exit(2) }

for path in paths {
    guard let img = NSImage(contentsOfFile: path),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        print("✗ \(path) 读图失败")
        continue
    }
    let req = VNDetectBarcodesRequest()
    req.symbologies = [.qr]
    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    do {
        try handler.perform([req])
        let results = (req.results ?? []).compactMap { $0.payloadStringValue }
        if results.isEmpty {
            print("✗ \(path) 未检测到二维码")
        } else {
            print("✓ \(path) 检测到 \(results.count) 个码：")
            for (i, v) in results.enumerated() {
                print("   [\(i + 1)] \(v.count > 90 ? String(v.prefix(90)) + "…" : v)")
            }
        }
    } catch {
        print("✗ \(path) Vision 失败: \(error)")
    }
}
