import {
  Vector3,
  BufferGeometry,
  BufferAttribute,
} from 'three';

class LineGeometry {
  constructor({ index = 0, points = [] }) {
    this.geometry = new BufferGeometry()
    this.count = points.length / 3
    this.points = points
    this.index = index
    this.initBuffers()
    this.update()
    return this.geometry
  }
  initBuffers() {
    const { geometry, count } = this
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(3 * count * 2), 3))
    geometry.setAttribute('previous', new BufferAttribute(new Float32Array(3 * count * 2), 3))
    geometry.setAttribute('next', new BufferAttribute(new Float32Array(3 * count * 2), 3))
    geometry.setAttribute('side', new BufferAttribute(new Float32Array(1 * count * 2), 1))
    geometry.setAttribute('lineIndex', new BufferAttribute(new Float32Array(1 * count * 2), 1))
    geometry.setAttribute('width', new BufferAttribute(new Float32Array(1 * count * 2), 1))
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(2 * count * 2), 2))
    geometry.setAttribute('uv2', new BufferAttribute(new Float32Array(2 * count * 2), 2))
    geometry.setIndex(new BufferAttribute(new Uint16Array(3 * (count - 1) * 2), 1))
    this.setStaticBuffers()
  }
  setStaticBuffers() {
    const { geometry, count } = this
    const attr = geometry.attributes
    for(let i = 0; i < count; i++) {
      attr.side.setXY(2 * i, 1, -1)
      attr.lineIndex.setXY(2 * i, this.index, this.index)
      if (i === count - 1) {
        continue;
      }
      let ind = 2 * i;
      geometry.index.array[3 * (ind + 0) + 0] = ind + 0;
      geometry.index.array[3 * (ind + 0) + 1] = ind + 1;
      geometry.index.array[3 * (ind + 0) + 2] = ind + 2;
      geometry.index.array[3 * (ind + 1) + 0] = ind + 2;
      geometry.index.array[3 * (ind + 1) + 1] = ind + 1;
      geometry.index.array[3 * (ind + 1) + 2] = ind + 3;
    }
  }
  getPos(index) {
    const { points } = this
    let i = 3 * index
    return [points[i], points[i + 1], points[i + 2]]
  }
  update() {
    const { points, count, geometry } = this
    const attr = geometry.attributes
    let prev = new Vector3()
    let curr = new Vector3()
    let length = 0
    for(let i = 0; i < count; i++) {
      // duplicate the line
      attr.position.setXYZ(2 * i + 0, points[3 * i + 0], points[3 * i + 1], points[3 * i + 2])
      attr.position.setXYZ(2 * i + 1, points[3 * i + 0], points[3 * i + 1], points[3 * i + 2])
      const prv = this.getPos(Math.max(0, i - 1))
      attr.previous.setXYZ(2 * i + 0, prv[0], prv[1], prv[2])
      attr.previous.setXYZ(2 * i + 1, prv[0], prv[1], prv[2])

      const nxt = this.getPos(Math.min(count - 1, i + 1))
      attr.next.setXYZ(2 * i + 0, nxt[0], nxt[1], nxt[2])
      attr.next.setXYZ(2 * i + 1, nxt[0], nxt[1], nxt[2])

      prev.fromArray(prv)
      curr.fromArray(this.getPos(i))
      length += prev.distanceTo(curr)
      attr.uv2.setX(2 * i + 0, length)
      attr.uv2.setX(2 * i + 1, length)
    }
    for(let i = 0; i < count; i++) {

      attr.uv.setXY(2 * i + 0, i / count, 0)
      attr.uv.setXY(2 * i + 1, i / count, 1)
      attr.uv2.setY(2 * i + 0, length)
      attr.uv2.setY(2 * i + 1, length)
      // TODO: taperFunction
      const w = 1
      attr.width.setXY(2 * i, w, w)
    }
    ;[attr.position, attr.previous, attr.next, attr.width, attr.uv, attr.uv2].forEach((attr) => {
      attr.needsUpdate = true
    })
  }
}

export default LineGeometry;
