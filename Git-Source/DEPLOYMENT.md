# CareXPS Healthcare CRM - Azure Static Web Apps Deployment

## Production Deployment: https://carexps.nexasync.ca

### Prerequisites

1. **Azure Static Web Apps Resource** configured for carexps.nexasync.ca
2. **GitHub Repository** with appropriate secrets configured
3. **Environment Variables** properly set up

### Deployment Configuration

#### Azure Static Web Apps Settings
- **Domain**: carexps.nexasync.ca
- **Build Location**: /
- **Output Location**: dist
- **API Location**: (empty - no backend APIs)

#### Required GitHub Secrets
```
AZURE_STATIC_WEB_APPS_API_TOKEN_CAREXPS - Your Azure Static Web Apps deployment token
```

#### Environment Variables (Set in Azure Static Web Apps Configuration)
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_AZURE_CLIENT_ID=your_azure_client_id
VITE_AZURE_TENANT_ID=your_azure_tenant_id
VITE_AZURE_REDIRECT_URI=https://carexps.nexasync.ca
VITE_APP_URL=https://carexps.nexasync.ca
VITE_APP_ENVIRONMENT=production
VITE_HIPAA_MODE=true
```

### Deployment Process

1. **Automatic Deployment**: Push to main/master branch triggers automatic deployment
2. **Manual Deployment**: Can be triggered via GitHub Actions
3. **Build Process**: 
   - Install dependencies (npm ci)
   - Build application (npm run build)
   - Deploy to Azure Static Web Apps

### Security Configuration

The application includes:
- **HTTPS Enforcement**
- **Security Headers** (HSTS, Content-Type-Options, Frame-Options, XSS-Protection)
- **HIPAA Compliance** mode
- **Content Security Policy**

### File Structure for Deployment

```
dist/                   # Built application files
├── index.html         # Main application entry
├── assets/           # Static assets (JS, CSS, images)
├── manifest.webmanifest # PWA manifest
└── sw.js             # Service worker

.github/workflows/     # GitHub Actions
├── azure-static-web-apps-carexps.yml

staticwebapp.config.json  # Azure Static Web Apps configuration
```

### Post-Deployment Checklist

1. ✅ Application builds successfully
2. ✅ Static Web Apps configuration applied
3. ✅ Security headers configured
4. ✅ Custom domain (carexps.nexasync.ca) configured
5. ⏳ Environment variables set in Azure
6. ⏳ SSL certificate provisioned
7. ⏳ DNS configured for carexps.nexasync.ca

### Monitoring and Maintenance

- **Application Insights**: Monitor application performance
- **Azure Monitoring**: Track resource usage
- **GitHub Actions**: Monitor deployment status
- **PWA Updates**: Service worker handles automatic updates

### Support

For deployment issues:
1. Check GitHub Actions logs
2. Review Azure Static Web Apps deployment logs  
3. Verify environment variables configuration
4. Test build locally with production settings

---

**Last Updated**: $(date)
**Production URL**: https://carexps.nexasync.ca
**Status**: Ready for Deployment
