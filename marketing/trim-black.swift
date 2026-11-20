#!/usr/bin/env swift
/**
 * 裁掉手机截图四周的纯黑边：扫描像素找非黑内容包围盒后裁剪输出。
 * 用法：swift trim-black.swift <input> <output> [亮度阈值 0-255，默认 24]
 */
import AppKit

let args = CommandLine.arguments
guard args.count >= 3 else { fputs("用法: swift trim-black.swift <in> <out> [阈值]\n", stderr); exit(2) }
let threshold = args.count >= 4 ? (Int(args[3]) ?? 24) : 24

guard let img = NSImage(contentsOfFile: args[1]),
      let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    fputs("读图失败: \(args[1])\n", stderr); exit(1)
}
let W = cg.width, H = cg.height
let space = CGColorSpaceCreateDeviceRGB()
var pixels = [UInt8](repeating: 0, count: W * H * 4)
guard let ctx = CGContext(data: &pixels, width: W, height: H,
                          bitsPerComponent: 8, bytesPerRow: W * 4,
                          space: space,
                          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
    fputs("建位图上下文失败\n", stderr); exit(1)
}
ctx.draw(cg, in: CGRect(x: 0, y: 0, width: W, height: H))

// 行/列非黑像素计数（亮度取 RGB 均值）
var rowCount = [Int](repeating: 0, count: H)
var colCount = [Int](repeating: 0, count: W)
for y in 0..<H {
    for x in 0..<W {
        let i = (y * W + x) * 4
        let bright = (Int(pixels[i]) + Int(pixels[i+1]) + Int(pixels[i+2])) / 3
        if bright > threshold {
            rowCount[y] += 1
            colCount[x] += 1
        }
    }
}
let minRowPixels = W / 50   // 一行至少 2% 像素非黑才算内容行
let minColPixels = H / 50

// 黑区里可能有零星噪点/UI 残影行，取「最长连续内容段」而不是首尾命中行
func longestRun(_ counts: [Int], minPixels: Int) -> (Int, Int) {
    var best = (0, -1), cur = (-1, -1)
    for (i, c) in counts.enumerated() {
        if c > minPixels {
            if cur.0 < 0 { cur.0 = i }
            cur.1 = i
        } else if cur.0 >= 0 {
            if cur.1 - cur.0 > best.1 - best.0 { best = cur }
            cur = (-1, -1)
        }
    }
    if cur.0 >= 0 && cur.1 - cur.0 > best.1 - best.0 { best = cur }
    return best.1 < 0 ? (0, counts.count - 1) : best
}
let (top, bottom) = longestRun(rowCount, minPixels: minRowPixels)
let (left, right) = longestRun(colCount, minPixels: minColPixels)

// CoreGraphics 坐标 y 自底向上
let crop = CGRect(x: left, y: H - 1 - bottom,
                  width: right - left + 1, height: bottom - top + 1)
guard let out = cg.cropping(to: crop) else { fputs("裁剪失败\n", stderr); exit(1) }

let rep = NSBitmapImageRep(cgImage: out)
guard let data = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.92]) else {
    fputs("编码失败\n", stderr); exit(1)
}
try data.write(to: URL(fileURLWithPath: args[2]))
print("✓ \(args[2])  \(out.width)×\(out.height)（原图 \(W)×\(H)，裁掉上下左右黑边）")
