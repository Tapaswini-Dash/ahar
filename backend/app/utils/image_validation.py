
from PIL import Image, ImageStat


def check_image_quality(image: Image.Image) -> dict:
    """Cheap, real checks before spending model/API time on a bad photo."""
    width, height = image.size
    issues = []

    if width < 200 or height < 200:
        issues.append("Image resolution is too low.")

    grayscale = image.convert("L")
    stat = ImageStat.Stat(grayscale)
    brightness = stat.mean[0]
    if brightness < 25:
        issues.append("Image is too dark.")
    elif brightness > 235:
        issues.append("Image is overexposed.")

    # Cheap blur proxy: low pixel-to-pixel variance means a flat/blurry photo.
    if stat.stddev[0] < 12:
        issues.append("Image looks blurry or low-detail.")

    return {"passed": len(issues) == 0, "issues": issues}