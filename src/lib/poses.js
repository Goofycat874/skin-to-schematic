// Pose angles are in degrees.
// pitch: swing forward (limbs) or tilt up (head)
// roll: raise outward away from the body (limbs) or tilt sideways (head)
// yaw: twist around the vertical axis
export const JOINTS = ['head', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg']

export const JOINT_LABELS = {
  head: 'Head',
  rightArm: 'Right arm',
  leftArm: 'Left arm',
  rightLeg: 'Right leg',
  leftLeg: 'Left leg',
}

export const JOINT_AXES = {
  head: ['pitch', 'yaw', 'roll'],
  rightArm: ['pitch', 'roll'],
  leftArm: ['pitch', 'roll'],
  rightLeg: ['pitch', 'roll'],
  leftLeg: ['pitch', 'roll'],
}

export const AXIS_LABELS = {
  pitch: 'Swing',
  roll: 'Raise',
  yaw: 'Turn',
}

export const POSES = [
  { id: 'stand', label: 'Stand', joints: {} },
  {
    id: 'walk',
    label: 'Stride',
    joints: {
      rightArm: { pitch: -32 },
      leftArm: { pitch: 32 },
      rightLeg: { pitch: 28 },
      leftLeg: { pitch: -28 },
    },
  },
  {
    id: 'wave',
    label: 'Wave',
    joints: {
      head: { yaw: -8, roll: -6 },
      rightArm: { roll: 150 },
      leftArm: { roll: 6 },
    },
  },
  {
    id: 'hero',
    label: 'Victory',
    joints: {
      head: { pitch: 12 },
      rightArm: { roll: 145 },
      leftArm: { roll: 145 },
      rightLeg: { roll: 8 },
      leftLeg: { roll: 8 },
    },
  },
  {
    id: 'tpose',
    label: 'T-pose',
    joints: {
      rightArm: { roll: 90 },
      leftArm: { roll: 90 },
    },
  },
  {
    id: 'zombie',
    label: 'Zombie',
    joints: {
      head: { pitch: -8 },
      rightArm: { pitch: 90 },
      leftArm: { pitch: 90 },
      rightLeg: { pitch: 12 },
      leftLeg: { pitch: -12 },
    },
  },
  {
    id: 'dab',
    label: 'Dab',
    joints: {
      head: { pitch: -28, yaw: 22, roll: 10 },
      rightArm: { roll: 128, pitch: 12 },
      leftArm: { pitch: 118, roll: -34 },
    },
  },
]

export function poseById(id) {
  return POSES.find((pose) => pose.id === id) ?? POSES[0]
}

export function resolvePose(options) {
  if (options?.pose === 'custom') return normalizeJoints(options.customPose)
  return normalizeJoints(poseById(options?.pose).joints)
}

export function normalizeJoints(joints = {}) {
  const result = {}
  for (const joint of JOINTS) {
    const source = joints?.[joint] ?? {}
    result[joint] = {
      pitch: Number(source.pitch) || 0,
      roll: Number(source.roll) || 0,
      yaw: Number(source.yaw) || 0,
    }
  }
  return result
}

// Builds a 3x3 rotation matrix (row-major) for a joint. Roll is applied first,
// then pitch, then yaw. Model space: +x is the character's left, +y is up and
// -z is the direction the character faces.
export function jointMatrix(joint, angles) {
  const side = joint.startsWith('left') ? 1 : -1
  const rollSign = joint === 'head' ? 1 : side
  const roll = toRadians(angles.roll * rollSign)
  const pitch = toRadians(angles.pitch)
  const yaw = toRadians(angles.yaw)
  return multiply(rotationY(yaw), multiply(rotationX(pitch), rotationZ(roll)))
}

export function isIdentity(matrix) {
  return (
    Math.abs(matrix[0] - 1) < 1e-9 &&
    Math.abs(matrix[4] - 1) < 1e-9 &&
    Math.abs(matrix[8] - 1) < 1e-9
  )
}

export function applyMatrix(matrix, [x, y, z]) {
  return [
    matrix[0] * x + matrix[1] * y + matrix[2] * z,
    matrix[3] * x + matrix[4] * y + matrix[5] * z,
    matrix[6] * x + matrix[7] * y + matrix[8] * z,
  ]
}

export function transpose(matrix) {
  return [
    matrix[0], matrix[3], matrix[6],
    matrix[1], matrix[4], matrix[7],
    matrix[2], matrix[5], matrix[8],
  ]
}

function rotationX(angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [1, 0, 0, 0, c, -s, 0, s, c]
}

function rotationY(angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [c, 0, s, 0, 1, 0, -s, 0, c]
}

function rotationZ(angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [c, -s, 0, s, c, 0, 0, 0, 1]
}

function multiply(a, b) {
  const out = new Array(9)
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      out[row * 3 + col] =
        a[row * 3] * b[col] + a[row * 3 + 1] * b[3 + col] + a[row * 3 + 2] * b[6 + col]
    }
  }
  return out
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}
