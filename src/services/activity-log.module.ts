import { Module } from '@nestjs/common';
import { ActivityLogService } from './activityLogService';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ActivityLogInterceptor } from '../interceptors/activity-log.interceptor';

@Module({
    imports: [
        PrismaModule,
        ConfigModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: {
                    expiresIn: configService.get<string>('JWT_EXPIRATION_TIME') || '3600s',
                },
            }),
        }),
    ],
    providers: [ActivityLogService, ActivityLogInterceptor],
    exports: [ActivityLogService, ActivityLogInterceptor],
})
export class ActivityLogModule { } 