export const STACK = 64
export const SHULKER = 27 * STACK

export function stackBreakdown(count) {
  return {
    shulkers: Math.floor(count / SHULKER),
    stacks: Math.floor(count / STACK),
    remainder: count % STACK,
  }
}

export function formatStacks(count) {
  const { stacks, remainder } = stackBreakdown(count)
  if (stacks === 0) return `${remainder}`
  if (remainder === 0) return `${stacks} st`
  return `${stacks} st + ${remainder}`
}

export function formatShulkers(count) {
  const boxes = count / SHULKER
  if (boxes < 0.1) return null
  return `${boxes < 10 ? boxes.toFixed(1) : Math.round(boxes)} shulker${boxes >= 1.05 ? 's' : ''}`
}

export function materialsToText(usedBlocks, title = 'Skinforge material list') {
  const total = usedBlocks.reduce((sum, block) => sum + block.count, 0)
  const lines = [
    title,
    `${total.toLocaleString('en-US')} blocks · ${usedBlocks.length} materials`,
    '',
  ]
  for (const block of usedBlocks) {
    lines.push(
      `${block.count.toLocaleString('en-US').padStart(7)} × ${block.label} (${formatStacks(block.count)})`,
    )
  }
  return lines.join('\n')
}

export function materialsToCsv(usedBlocks) {
  const rows = [['Block', 'Block state', 'Count', 'Stacks', 'Remainder', 'Shulker boxes']]
  for (const block of usedBlocks) {
    const { stacks, remainder } = stackBreakdown(block.count)
    rows.push([
      block.label,
      block.state,
      block.count,
      stacks,
      remainder,
      (block.count / SHULKER).toFixed(2),
    ])
  }
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`
}

function csvCell(value) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
