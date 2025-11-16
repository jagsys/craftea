export class Node3D {
  constructor(
    public name: string,
    public x: number,
    public y: number,
    public z: number,
    public id?: number
  ) {}

  distanceTo(other: Node3D): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const dz = this.z - other.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  toString(): string {
    return `${this.name}[${this.x}, ${this.y}, ${this.z}]`;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      z: this.z,
    };
  }
}

export class Line3D {
  constructor(
    public name: string,
    public node1: Node3D,
    public node2: Node3D,
    public id?: number
  ) {}

  get length(): number {
    return this.node1.distanceTo(this.node2);
  }

  toString(): string {
    return `${this.name}[${this.node1.name}, ${this.node2.name}] - ${this.length.toFixed(3)}m`;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      node1Id: this.node1.id,
      node2Id: this.node2.id,
    };
  }
}
