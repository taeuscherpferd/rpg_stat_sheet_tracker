Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$projectDirectory = Split-Path $PSScriptRoot -Parent
$assetDirectory = Join-Path $projectDirectory 'frontend/src/assets/characters'
$sourceStream = [System.IO.MemoryStream]::new([System.IO.File]::ReadAllBytes((Join-Path $assetDirectory 'character-sprite-source.png')))
$source = [System.Drawing.Bitmap]::FromStream($sourceStream)
$columns = @(0, 152, 304, 457, 614, 760, 916, 1072, 1223, 1378, 1536)
$rows = @(@(9, 168), @(170, 321), @(322, 478), @(480, 638), @(640, 808), @(811, 993))
$atlas = [System.Drawing.Bitmap]::new(1600, 208 * $rows.Count)

try {
    for ($row = 0; $row -lt $rows.Count; $row++) {
        for ($column = 0; $column -lt 10; $column++) {
            $left = $columns[$column]
            $right = $columns[$column + 1] - 1
            $top = $rows[$row][0]
            $bottom = $rows[$row][1]
            $footLeft = $right
            $footRight = $left
            $footBottom = $top
            $shirtPixelCounts = [int[]]::new($right - $left + 1)
            $shirtPixelTotal = 0

            for ($y = $top; $y -le $bottom; $y++) {
                for ($x = $left; $x -le $right; $x++) {
                    $pixel = $source.GetPixel($x, $y)
                    if ($y -ge $bottom - 12 -and $pixel.A -gt 32) {
                        $footLeft = [Math]::Min($footLeft, $x)
                        $footRight = [Math]::Max($footRight, $x)
                        $footBottom = [Math]::Max($footBottom, $y)
                    }
                    if ($pixel.A -gt 128 -and $pixel.G -gt $pixel.R * 1.05 -and $pixel.G -gt $pixel.B * 1.1) {
                        $shirtPixelCounts[$x - $left]++
                        $shirtPixelTotal++
                    }
                }
            }

            $torsoCenter = [int][Math]::Round(($footLeft + $footRight) / 2)
            $shirtPixelCumulative = 0
            for ($offset = 0; $offset -lt $shirtPixelCounts.Length -and $shirtPixelTotal -gt 0; $offset++) {
                $shirtPixelCumulative += $shirtPixelCounts[$offset]
                if ($shirtPixelCumulative -gt [Math]::Floor($shirtPixelTotal / 2)) {
                    $torsoCenter = $left + $offset
                    break
                }
            }
            $destinationX = $column * 160 + 80 + $left - $torsoCenter
            $destinationY = $row * 208 + 200 + $top - $footBottom
            $rectangle = [System.Drawing.Rectangle]::new($left, $top, $right - $left + 1, $bottom - $top + 1)
            $leftOverflow = [Math]::Max(0, $column * 160 - $destinationX)
            $rectangle.X += $leftOverflow
            $rectangle.Width -= $leftOverflow
            $destinationX += $leftOverflow
            $rectangle.Width = [Math]::Min($rectangle.Width, ($column + 1) * 160 - $destinationX)
            $destinationRectangle = [System.Drawing.Rectangle]::new($destinationX, $destinationY, $rectangle.Width, $rectangle.Height)
            $sourcePixels = $source.LockBits($rectangle, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
            $destinationPixels = $atlas.LockBits($destinationRectangle, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
            try {
                $pixelRow = [byte[]]::new($rectangle.Width * 4)
                for ($pixelY = 0; $pixelY -lt $rectangle.Height; $pixelY++) {
                    $sourceAddress = [IntPtr]::Add($sourcePixels.Scan0, $pixelY * $sourcePixels.Stride)
                    $destinationAddress = [IntPtr]::Add($destinationPixels.Scan0, $pixelY * $destinationPixels.Stride)
                    [System.Runtime.InteropServices.Marshal]::Copy($sourceAddress, $pixelRow, 0, $pixelRow.Length)
                    [System.Runtime.InteropServices.Marshal]::Copy($pixelRow, 0, $destinationAddress, $pixelRow.Length)
                }
            } finally {
                $atlas.UnlockBits($destinationPixels)
                $source.UnlockBits($sourcePixels)
            }
        }
    }

    $atlas.Save((Join-Path $assetDirectory 'character-sprite-sheet.png'), [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
    $atlas.Dispose()
    $source.Dispose()
    $sourceStream.Dispose()
}
