import type { User } from '../lib/db';

declare global {
  namespace Express {
    interface User extends User {}
  }
}
