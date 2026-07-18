const TAG = {
  end: 0,
  byte: 1,
  short: 2,
  int: 3,
  long: 4,
  float: 5,
  double: 6,
  byteArray: 7,
  string: 8,
  list: 9,
  compound: 10,
  intArray: 11,
  longArray: 12,
}

const encoder = new TextEncoder()

export const nbtTag = TAG

export function writeNbt(rootName, value) {
  const writer = new BinaryWriter()
  writer.byte(TAG.compound)
  writer.string(rootName)
  writeCompoundPayload(writer, value)
  return writer.toUint8Array()
}

export function byte(value) {
  return { type: TAG.byte, value }
}

export function short(value) {
  return { type: TAG.short, value }
}

export function int(value) {
  return { type: TAG.int, value }
}

export function string(value) {
  return { type: TAG.string, value }
}

export function byteArray(value) {
  return { type: TAG.byteArray, value }
}

export function intArray(value) {
  return { type: TAG.intArray, value }
}

export function list(childType, value = []) {
  return { type: TAG.list, childType, value }
}

export function compound(value) {
  return { type: TAG.compound, value }
}

function writeNamedTag(writer, name, tag) {
  writer.byte(tag.type)
  writer.string(name)
  writePayload(writer, tag)
}

function writePayload(writer, tag) {
  if (tag.type === TAG.byte) writer.byte(tag.value)
  else if (tag.type === TAG.short) writer.short(tag.value)
  else if (tag.type === TAG.int) writer.int(tag.value)
  else if (tag.type === TAG.string) writer.string(tag.value)
  else if (tag.type === TAG.byteArray) writer.byteArray(tag.value)
  else if (tag.type === TAG.intArray) writer.intArray(tag.value)
  else if (tag.type === TAG.list) writer.list(tag.childType, tag.value)
  else if (tag.type === TAG.compound) writeCompoundPayload(writer, tag.value)
  else throw new Error(`Unsupported NBT tag type: ${tag.type}`)
}

function writeCompoundPayload(writer, value) {
  for (const [name, tag] of Object.entries(value)) {
    writeNamedTag(writer, name, tag)
  }
  writer.byte(TAG.end)
}

class BinaryWriter {
  bytes = []

  byte(value) {
    this.bytes.push(value & 0xff)
  }

  short(value) {
    this.bytes.push((value >> 8) & 0xff, value & 0xff)
  }

  int(value) {
    this.bytes.push(
      (value >> 24) & 0xff,
      (value >> 16) & 0xff,
      (value >> 8) & 0xff,
      value & 0xff,
    )
  }

  string(value) {
    const data = encoder.encode(value)
    this.short(data.length)
    this.bytes.push(...data)
  }

  byteArray(value) {
    this.int(value.length)
    for (const item of value) this.byte(item)
  }

  intArray(value) {
    this.int(value.length)
    for (const item of value) this.int(item)
  }

  list(childType, value) {
    this.byte(childType)
    this.int(value.length)
    for (const item of value) {
      if (childType === TAG.compound) writeCompoundPayload(this, item.value ?? item)
      else writePayload(this, item)
    }
  }

  toUint8Array() {
    return Uint8Array.from(this.bytes)
  }
}
