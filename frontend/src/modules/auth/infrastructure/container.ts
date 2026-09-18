import { makeAuthService } from '../application/authUseCases';
import { HttpAuthRepository } from './HttpAuthRepository';

/** Composition root for the auth module. Presentation imports this, not the classes. */
export const authService = makeAuthService(new HttpAuthRepository());
