
export interface VideoContentRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Calculates the actual displayed dimensions and offsets of a video 
 * rendered with "object-fit: contain".
 */
export const calculateVideoContentRect = (video: HTMLVideoElement): VideoContentRect | null => {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;

  const containerWidth = video.clientWidth;
  const containerHeight = video.clientHeight;
  const videoAspectRatio = video.videoWidth / video.videoHeight;
  const containerAspectRatio = containerWidth / containerHeight;

  let contentWidth, contentHeight, contentLeft, contentTop;

  if (videoAspectRatio > containerAspectRatio) {
    // Video is wider than container (relative to height)
    contentWidth = containerWidth;
    contentHeight = containerWidth / videoAspectRatio;
    contentLeft = 0;
    contentTop = (containerHeight - contentHeight) / 2;
  } else {
    // Video is taller than container (relative to width)
    contentHeight = containerHeight;
    contentWidth = containerHeight * videoAspectRatio;
    contentTop = 0;
    contentLeft = (containerWidth - contentWidth) / 2;
  }

  return {
    top: contentTop,
    left: contentLeft,
    width: contentWidth,
    height: contentHeight,
  };
};
