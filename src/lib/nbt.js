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

// Longs are written from a JS number (safe up to 2^53) or a BigInt.
export function long(value) {
  return { type: TAG.long, value }
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

// words holds each long as two uint32 values: [low0, high0, low1, high1, ...]
export function longArrayFromWords(words) {
  return { type: TAG.longArray, words }
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
  else if (tag.type === TAG.long) writer.long(tag.value)
  else if (tag.type === TAG.string) writer.string(tag.value)
  else if (tag.type === TAG.byteArray) writer.byteArray(tag.value)
  else if (tag.type === TAG.intArray) writer.intArray(tag.value)
  else if (tag.type === TAG.longArray) writer.longArrayWords(tag.words)
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
  buffer = new Uint8Array(4096)
  length = 0

  reserve(extra) {
    const needed = this.length + extra
    if (needed <= this.buffer.length) return
    let next = this.buffer.length * 2
    while (next < needed) next *= 2
    const grown = new Uint8Array(next)
    grown.set(this.buffer.subarray(0, this.length))
    this.buffer = grown
  }

  byte(value) {
    this.reserve(1)
    this.buffer[this.length++] = value & 0xff
  }

  short(value) {
    this.reserve(2)
    this.buffer[this.length++] = (value >> 8) & 0xff
    this.buffer[this.length++] = value & 0xff
  }

  int(value) {
    this.reserve(4)
    this.buffer[this.length++] = (value >> 24) & 0xff
    this.buffer[this.length++] = (value >> 16) & 0xff
    this.buffer[this.length++] = (value >> 8) & 0xff
    this.buffer[this.length++] = value & 0xff
  }

  long(value) {
    const big = BigInt.asUintN(64, BigInt(value))
    this.int(Number((big >> 32n) & 0xffffffffn) | 0)
    this.int(Number(big & 0xffffffffn) | 0)
  }

  string(value) {
    const data = encoder.encode(value)
    if (data.length > 0xffff) throw new Error('NBT string is too long.')
    this.short(data.length)
    this.reserve(data.length)
    this.buffer.set(data, this.length)
    this.length += data.length
  }

  byteArray(value) {
    this.int(value.length)
    this.reserve(value.length)
    if (value instanceof Uint8Array || value instanceof Int8Array) {
      this.buffer.set(new Uint8Array(value.buffer, value.byteOffset, value.length), this.length)
      this.length += value.length
    } else {
      for (const item of value) this.buffer[this.length++] = item & 0xff
    }
  }

  intArray(value) {
    this.int(value.length)
    for (const item of value) this.int(item)
  }

  longArrayWords(words) {
    const count = words.length / 2
    this.int(count)
    this.reserve(count * 8)
    for (let index = 0; index < count; index += 1) {
      this.int(words[index * 2 + 1] | 0)
      this.int(words[index * 2] | 0)
    }
  }

  list(childType, value) {
    this.byte(value.length === 0 ? TAG.end : childType)
    this.int(value.length)
    for (const item of value) {
      if (childType === TAG.compound) writeCompoundPayload(this, item.value ?? item)
      else writePayload(this, item)
    }
  }

  toUint8Array() {
    return this.buffer.slice(0, this.length)
  }
}
