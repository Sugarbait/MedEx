# CareXPS Healthcare CRM

A HIPAA-compliant healthcare CRM application with Retell AI integration, built for Azure Static Web Apps with Supabase backend and cross-device settings synchronization.

## 🏥 Features

### Healthcare-Specific Features
- **HIPAA Compliance**: End-to-end encryption, audit logging, secure data handling
- **Retell AI Integration**: Real-time call transcription and sentiment analysis
- **Cross-Device Sync**: Settings and preferences sync across all user devices
- **Role-Based Access Control**: Admin, healthcare provider, and staff roles
- **Multi-Factor Authentication**: Biometric and TOTP support
- **Real-time Updates**: Live data synchronization for calls, SMS, and analytics

### Core Functionality
- **Dashboard**: Real-time metrics and system health monitoring
- **Call Management**: Transcription viewer, sentiment analysis, recording playback
- **SMS Management**: Secure messaging with template support and PHI detection
- **Analytics**: Comprehensive reporting for calls and SMS performance
- **Settings**: Administrative controls with audit trails
- **Security**: Real-time security monitoring and compliance metrics

## 🛠️ Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with healthcare-specific design system
- **Authentication**: Azure AD (MSAL) + Multi-Factor Authentication
- **Database**: Supabase with Row Level Security (RLS)
- **Deployment**: Azure Static Web Apps
- **Real-time**: Supabase Realtime subscriptions
- **Security**: AES-256 encryption, HTTPS enforcement, CSP headers

## 🚀 Quick Start

### Prerequisites

1. **Azure Account** with Azure AD tenant
2. **Supabase Account** and project
3. **Retell AI Account** (optional for demo)
4. **Node.js 18+** and npm

### 1. Environment Setup

```bash
# Clone the repository
git clone <repository-url>
cd carexps-healthcare-crm

# Install dependencies
npm install

# Copy environment template
cp .env.local.example .env.local
```

### 2. Configure Environment Variables

Edit `.env.local` with your credentials:

```env
# Azure AD Configuration
VITE_AZURE_CLIENT_ID=your-azure-ad-client-id
VITE_AZURE_TENANT_ID=your-azure-ad-tenant-id

# Supabase Configuration
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Retell AI Configuration (optional)
VITE_RETELL_API_KEY=your-retell-ai-api-key
VITE_RETELL_ENDPOINT=https://api.retellai.com

# Security Configuration
VITE_ENCRYPTION_KEY=your-32-character-encryption-key
VITE_SESSION_TIMEOUT=900000

# Environment
VITE_ENVIRONMENT=development
```

### 3. Database Setup

The Supabase expert agent has created all necessary database migrations and security policies. Follow the setup guide in `SUPABASE_SETUP.md` for detailed instructions.

### 4. Azure AD Setup

1. Register your application in Azure AD
2. Configure redirect URIs for your domain
3. Set up API permissions for Microsoft Graph
4. Create client secret for production deployment

### 5. Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## 🔒 Security Features

### HIPAA Compliance
- **Data Encryption**: AES-256-GCM for PHI at rest
- **Transmission Security**: TLS 1.2+ for all communications
- **Access Controls**: Role-based permissions with audit trails
- **Session Management**: 15-minute timeout with MFA requirements
- **Audit Logging**: Complete audit trail for all data access

### Security Headers
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options
- Referrer Policy

### Real-time Security Monitoring
- Failed login attempt tracking
- Session anomaly detection
- Real-time security event logging
- Compliance metrics dashboard

## 📱 Mobile-First Design

The application is built with a mobile-first approach and includes:

- **Responsive Design**: Optimized for mobile, tablet, and desktop
- **Progressive Web App (PWA)**: Installable on mobile devices
- **Touch-Friendly**: 48px minimum touch targets
- **Accessibility**: WCAG 2.1 AAA compliance for healthcare
- **Offline Support**: Service worker for offline functionality

## 🔧 Development

### Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build

# Quality Assurance
npm run lint         # Run ESLint
npm run test         # Run tests
npm run test:coverage # Run tests with coverage

# Type Checking
npx tsc --noEmit     # Check TypeScript types
```

### Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── ui/          # Basic UI components
│   ├── layout/      # Layout components
│   ├── auth/        # Authentication components
│   └── charts/      # Chart components
├── pages/           # Page components
├── contexts/        # React contexts
├── hooks/           # Custom React hooks
├── services/        # API services
├── utils/           # Utility functions
├── types/           # TypeScript type definitions
└── assets/          # Static assets
```

## 🚀 Deployment

### Azure Static Web Apps

1. **Create Azure Static Web App**:
   ```bash
   az staticwebapp create \\
     --name carexps-healthcare-crm \\
     --resource-group your-resource-group \\
     --source https://github.com/your-username/your-repo \\
     --location "East US 2" \\
     --branch main \\
     --app-location "/" \\
     --output-location "dist"
   ```

2. **Configure Secrets** in GitHub repository:
   - `AZURE_STATIC_WEB_APPS_API_TOKEN`
   - `AZURE_CLIENT_ID`
   - `AZURE_CLIENT_SECRET`
   - `AZURE_TENANT_ID`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `RETELL_API_KEY`
   - `ENCRYPTION_KEY`

3. **Deploy**: Push to main branch triggers automatic deployment

### Custom Domain & SSL

Configure custom domain in Azure portal and enable SSL certificate.

## 📊 Monitoring & Analytics

### Built-in Monitoring
- **Application Insights**: Automatic error tracking and performance monitoring
- **Supabase Analytics**: Database performance and usage metrics
- **Security Dashboard**: Real-time security events and compliance status
- **User Analytics**: Cross-device usage patterns and preferences

### Health Checks
- Database connectivity
- External API status (Retell AI)
- Authentication service health
- Real-time subscription status

## 🔄 Cross-Device Features

### Settings Synchronization
Settings automatically sync across all user devices:
- Theme preferences (light/dark/auto)
- Notification preferences
- Dashboard layout customization
- Security preferences
- Accessibility settings
- Communication preferences

### Conflict Resolution
- Optimistic updates with conflict detection
- Last-write-wins for simple preferences
- User-prompted resolution for complex conflicts
- Automatic retry with exponential backoff

## 🧪 Testing

### Test Coverage
- Unit tests for utilities and services
- Integration tests for API endpoints
- Component tests for React components
- End-to-end tests for critical workflows

### Security Testing
- Penetration testing checklist
- OWASP security verification
- HIPAA compliance validation
- Performance and load testing

## 📚 Documentation

- **API Documentation**: Available in `/docs/api/`
- **Component Library**: Storybook setup for UI components
- **Security Guide**: HIPAA compliance and security best practices
- **Deployment Guide**: Step-by-step deployment instructions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the coding standards
4. Add tests for new functionality
5. Ensure security compliance
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For technical support or questions:
- Create an issue in the GitHub repository
- Contact the development team
- Review the documentation in `/docs/`

## 🔍 Compliance

This application is designed to meet:
- **HIPAA**: Health Insurance Portability and Accountability Act
- **SOC 2**: Service Organization Control 2
- **GDPR**: General Data Protection Regulation (where applicable)
- **FedRAMP**: Federal Risk and Authorization Management Program (preparation)

Regular compliance audits and security assessments are recommended.