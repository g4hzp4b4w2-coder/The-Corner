// Shared synthetic-landmark builder for tests. Only NOSE(0), SHOULDER
// (11,12) and WRIST(15,16) are ever read by the modules under test, so
// other indices are left undefined.
export function makeLandmarks({ nose, leftShoulder, rightShoulder, leftWrist, rightWrist } = {}) {
  const landmarks = [];
  landmarks[0] = nose ?? { x: 0.5, y: 0.3, visibility: 1 };
  landmarks[11] = leftShoulder ?? { x: 0.4, y: 0.5, visibility: 1 };
  landmarks[12] = rightShoulder ?? { x: 0.6, y: 0.5, visibility: 1 };
  landmarks[15] = leftWrist ?? { x: 0.4, y: 0.7, visibility: 1 };
  landmarks[16] = rightWrist ?? { x: 0.6, y: 0.7, visibility: 1 };
  return landmarks;
}
