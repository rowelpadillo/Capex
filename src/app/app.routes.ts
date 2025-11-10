import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/main/dashboard/dashboard.component'; 

export const routes: Routes = [
    // 1. ADD THIS LINE:
    // This redirects the base URL (localhost:4200) to /dashboard
    { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  
    // 2. This is your existing route
    { path: 'dashboard', component: DashboardComponent },
];