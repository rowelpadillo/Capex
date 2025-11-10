import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config'; // 1. Import appConfig

bootstrapApplication(AppComponent, appConfig) // 2. Use appConfig here
  .catch((err) => console.error(err));