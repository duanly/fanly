#!/usr/bin/env swift
/**
 * 文档照片矫正：Vision 检测文档四边形 → CIPerspectiveCorrection 透视拉正
 * → CIHighlightShadowAdjust 提阴影 → 轻微对比/锐化，输出 JPEG。
 * 检测不到边缘时退化为只做光影修正（不裁切）。
 * 用法：swift fix-document.swift <input> <output>
 */
import AppKit
import Vision
import CoreImage

let args = CommandLine.arguments
guard args.count >= 3 else { fputs("用法: swift fix-document.swift <in> <out>\n", stderr); exit(2) }
let inURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])

guard let nsImage = NSImage(contentsOfFile: inURL.path),
      let cgImage = nsImage.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    fputs("读图失败\n", stderr); exit(1)
}
var ciImage = CIImage(cgImage: cgImage)

// 1) 文档边缘检测（Vision 坐标与 CIImage 同为左下原点，归一化后乘尺寸即可）
let request = VNDetectDocumentSegmentationRequest()
let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do { try handler.perform([request]) } catch { fputs("Vision 失败: \(error)\n", stderr); exit(1) }

if let obs = request.results?.first {
    let W = ciImage.extent.width, H = ciImage.extent.height
    let vec = { (p: CGPoint) -> CIVector in CIVector(x: p.x * W, y: p.y * H) }
    let pf = CIFilter(name: "CIPerspectiveCorrection")!
    pf.setValue(ciImage, forKey: kCIInputImageKey)
    pf.setValue(vec(obs.topLeft), forKey: "inputTopLeft")
    pf.setValue(vec(obs.topRight), forKey: "inputTopRight")
    pf.setValue(vec(obs.bottomLeft), forKey: "inputBottomLeft")
    pf.setValue(vec(obs.bottomRight), forKey: "inputBottomRight")
    if let warped = pf.outputImage {
        ciImage = warped
        print("✓ 透视矫正完成，四边形: TL=\(obs.topLeft) TR=\(obs.topRight) BL=\(obs.bottomLeft) BR=\(obs.bottomRight)")
    }
} else {
    fputs("⚠ 未检测到文档边缘，跳过透视矫正\n", stderr)
}

// 2) 透视后向内微裁，切掉边缘外的背景杂物（右上手机 UI 残影、底部黑边）
//    顺序：上、右、下、左的裁切比例
let cropFrac = (top: 0.010, right: 0.008, bottom: 0.022, left: 0.008)
let ext = ciImage.extent
let cropRect = CIVector(
    x: ext.minX + ext.width * cropFrac.left,
    y: ext.minY + ext.height * cropFrac.bottom,
    z: ext.width * (1 - cropFrac.left - cropFrac.right),
    w: ext.height * (1 - cropFrac.top - cropFrac.bottom)
)
let crop = CIFilter(name: "CICrop")!
crop.setValue(ciImage, forKey: kCIInputImageKey)
crop.setValue(cropRect, forKey: "inputRectangle")
ciImage = crop.outputImage?.cropped(to: CGRect(
    x: cropRect.x, y: cropRect.y, width: cropRect.z, height: cropRect.w)) ?? ciImage

// 3) 强力提亮阴影（手机照下方/侧边发黑、手掌阴影的核心处理）
let shadow = CIFilter(name: "CIHighlightShadowAdjust")!
shadow.setValue(ciImage, forKey: kCIInputImageKey)
shadow.setValue(1.15, forKey: "inputShadowAmount")
shadow.setValue(0.97, forKey: "inputHighlightAmount")
ciImage = shadow.outputImage ?? ciImage

// 4) 白点校正：把浅灰底推向纸白，消除整体灰蒙
let white = CIFilter(name: "CIWhitePointAdjust")!
white.setValue(ciImage, forKey: kCIInputImageKey)
white.setValue(CIColor(red: 0.90, green: 0.90, blue: 0.90), forKey: kCIInputColorKey)
ciImage = white.outputImage ?? ciImage

// 5) 轻微对比/饱和，避免提亮后发灰
let color = CIFilter(name: "CIColorControls")!
color.setValue(ciImage, forKey: kCIInputImageKey)
color.setValue(0.03, forKey: kCIInputBrightnessKey)
color.setValue(1.05, forKey: kCIInputContrastKey)
color.setValue(0.92, forKey: kCIInputSaturationKey)
ciImage = color.outputImage ?? ciImage

// 4) 轻锐化，缩小展示时文字更清楚
let sharp = CIFilter(name: "CISharpenLuminance")!
sharp.setValue(ciImage, forKey: kCIInputImageKey)
sharp.setValue(0.35, forKey: kCIInputSharpnessKey)
ciImage = sharp.outputImage ?? ciImage

let context = CIContext(options: [.workingColorSpace: CGColorSpace(name: CGColorSpace.sRGB)!])
guard let outCG = context.createCGImage(ciImage, from: ciImage.extent) else {
    fputs("渲染输出失败\n", stderr); exit(1)
}
let rep = NSBitmapImageRep(cgImage: outCG)
guard let data = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.93]) else {
    fputs("JPEG 编码失败\n", stderr); exit(1)
}
try data.write(to: outURL)
print("✓ \(outURL.path)  \(outCG.width)×\(outCG.height)")
