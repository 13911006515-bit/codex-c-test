const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
export function measureHand(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length !== 21 || landmarks.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || (p.z !== undefined && !Number.isFinite(p.z)))) return null;
  const wrist = landmarks[0];
  const scale = distance(wrist, landmarks[9]);
  if (scale < 0.0001) return null;
  // Tip-to-wrist distances relative to MCP joints are rotation and scale independent.
  let openness = 0;
  for (const [base, tip] of [[5, 8], [9, 12], [13, 16], [17, 20]]) {
    const extension = (distance(wrist, landmarks[tip]) - distance(wrist, landmarks[base])) / scale;
    openness += Math.max(0, Math.min(1, (extension - 0.05) / 0.75));
  }
  return { openness: openness / 4, x: 1 - landmarks[8].x, y: landmarks[8].y };
}
export function smooth(current, target, delta, speed = 6) {
  return current + (target - current) * (1 - Math.exp(-speed * Math.min(delta, 0.1)));
}
