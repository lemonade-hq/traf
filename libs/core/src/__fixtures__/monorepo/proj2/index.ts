import { proj1 } from '@monorepo/proj1';

export { proj1 } from '@monorepo/proj1';

export function proj2() {
  proj1();
  return 'proj2';
}

export function anotherFn() {
  return 'anotherFn';
}

const Decorator = () => (target: typeof MyClass) => target;

@Decorator()
export class MyClass {
  constructor() {
    proj1();
  }
}
