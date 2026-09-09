import { makeAuthService } from '../application/authUseCases';
import { InMemoryAuthRepository } from './InMemoryAuthRepository';

/** Composition root for the auth module. Presentation imports this, not the classes. */
export const authService = makeAuthService(new InMemoryAuthRepository());
