import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    private readonly logger = new Logger(JwtAuthGuard.name);

    // This guard activates the 'jwt' strategy (JwtStrategy)
    // The logic for token validation and payload extraction is in JwtStrategy.validate()
    // Optionally, you can override handleRequest to customize error handling
    // or to allow access even if the token is invalid (e.g., for optionally authenticated routes)
    handleRequest(err: any, user: any, info: any, context: any) {
        this.logger.debug(`JwtAuthGuard - Processing request: ${context.switchToHttp().getRequest().url}`);
        this.logger.debug(`JwtAuthGuard - User from token: ${JSON.stringify(user)}`);

        if (err || !user) {
            this.logger.warn(`JwtAuthGuard - Authentication failed: ${err?.message || info?.message || 'No user found'}`);
            throw err || new UnauthorizedException(info?.message || 'Invalid or expired token');
        }

        this.logger.debug(`JwtAuthGuard - Authentication successful for user: ${user.email}`);
        return user;
    }
}
