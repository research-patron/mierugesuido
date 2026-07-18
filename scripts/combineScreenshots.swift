import AppKit
import Foundation

guard CommandLine.arguments.count == 4 else {
  fputs("usage: combineScreenshots <left> <right> <output>\n", stderr)
  exit(2)
}

let leftPath = CommandLine.arguments[1]
let rightPath = CommandLine.arguments[2]
let outputPath = CommandLine.arguments[3]

guard let left = NSImage(contentsOfFile: leftPath),
      let right = NSImage(contentsOfFile: rightPath) else {
  fputs("could not open one or both screenshots\n", stderr)
  exit(1)
}

let gap: CGFloat = 24
let canvasSize = NSSize(
  width: left.size.width + gap + right.size.width,
  height: max(left.size.height, right.size.height)
)
let canvas = NSImage(size: canvasSize)
canvas.lockFocus()
NSColor(calibratedWhite: 0.94, alpha: 1).setFill()
NSRect(origin: .zero, size: canvasSize).fill()
left.draw(in: NSRect(x: 0, y: canvasSize.height - left.size.height, width: left.size.width, height: left.size.height))
right.draw(in: NSRect(x: left.size.width + gap, y: canvasSize.height - right.size.height, width: right.size.width, height: right.size.height))
canvas.unlockFocus()

guard let tiff = canvas.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiff),
      let png = bitmap.representation(using: .png, properties: [:]) else {
  fputs("could not encode comparison image\n", stderr)
  exit(1)
}

try png.write(to: URL(fileURLWithPath: outputPath))
