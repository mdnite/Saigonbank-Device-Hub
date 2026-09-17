import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  setupApp(app);
  app.enableCors({ origin: config.getOrThrow<string>('CORS_ORIGIN') });
  await app.listen(config.get<number>('PORT') ?? 3000);
}
void bootstrap();
