# SinapsisData - Google Ads API Integration
## Design Documentation

**Company:** Somos Sinapsis SL
**Product:** SinapsisData - Marketing Analytics Platform
**Website:** https://sinapsis.agency
**Contact:** nicola.picasso@somosinapsis.com
**Date:** March 2026
**Version:** 1.0

---

## 1. Executive Summary

SinapsisData is an internal reporting and analytics platform developed by Somos Sinapsis SL, a digital marketing agency based in Spain. The platform consolidates marketing data from multiple sources to generate automated performance reports for our agency's clients.

The Google Ads API integration will enable us to:
- Automatically retrieve campaign performance metrics
- Generate consolidated marketing reports
- Provide clients with data-driven insights
- Analyze search terms and keyword performance

**Important:** This tool is for internal agency use only. We do not resell API access or provide this tool to third parties.

---

## 2. Company Information

| Field | Details |
|-------|---------|
| Legal Name | Somos Sinapsis SL |
| Website | https://sinapsis.agency |
| Industry | Digital Marketing Agency |
| Location | Spain |
| Primary Service | Performance Marketing & Analytics |

### Services We Provide
- Google Ads campaign management
- Performance marketing strategy
- Marketing analytics and reporting
- Conversion rate optimization

---

## 3. Tool Overview

### 3.1 Purpose
SinapsisData automates the collection and visualization of marketing performance data for our agency clients. Instead of manually exporting data from multiple platforms, the tool centralizes all metrics in one dashboard.

### 3.2 Target Users
- **Internal:** Sinapsis Agency account managers and analysts
- **External:** Agency clients (read-only access to their own reports)

### 3.3 Key Features

| Feature | Description | API Access Required |
|---------|-------------|---------------------|
| Campaign Metrics Dashboard | Display impressions, clicks, conversions, cost, ROAS | Read-only |
| Automated Reports | Generate weekly/monthly performance reports | Read-only |
| Search Terms Analysis | Analyze search queries triggering ads | Read-only |
| Keyword Performance | Track keyword-level metrics | Read-only |
| Budget Monitoring | Alert when budgets are nearly depleted | Read-only |

---

## 4. Technical Architecture

### 4.1 Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14 (React) |
| Backend | Next.js API Routes |
| Database | PostgreSQL with Prisma ORM |
| Authentication | NextAuth.js |
| AI Analysis | Claude API (Anthropic) |
| Hosting | Cloud Infrastructure (EU Region) |

### 4.2 System Architecture Diagram

```
+------------------+     +-------------------+     +------------------+
|                  |     |                   |     |                  |
|  Google Ads API  +---->+  SinapsisData     +---->+  PostgreSQL DB   |
|  (Data Source)   |     |  Backend          |     |  (Data Storage)  |
|                  |     |                   |     |                  |
+------------------+     +--------+----------+     +------------------+
                                  |
                                  v
                         +--------+----------+
                         |                   |
                         |  Web Dashboard    |
                         |  (Client Reports) |
                         |                   |
                         +-------------------+
```

### 4.3 Data Flow

1. **Authentication:** OAuth 2.0 flow to obtain access tokens
2. **Data Retrieval:** Scheduled API calls to fetch campaign metrics
3. **Data Storage:** Metrics stored in PostgreSQL database
4. **Report Generation:** AI-powered analysis generates insights
5. **Delivery:** Reports available via web dashboard or email

---

## 5. Google Ads API Usage Details

### 5.1 Resources We Will Access

| Resource | Purpose | Access Type |
|----------|---------|-------------|
| `customers` | List managed accounts | Read |
| `campaigns` | Get campaign performance | Read |
| `ad_groups` | Get ad group metrics | Read |
| `ads` | Get ad performance | Read |
| `keywords` | Get keyword metrics | Read |
| `search_terms` | Analyze search queries | Read |

### 5.2 API Call Patterns

- **Frequency:** Daily batch updates (off-peak hours)
- **Volume:** Estimated 500-2,000 API calls per day
- **Caching:** 24-hour cache to minimize redundant calls

### 5.3 We Will NOT Use the API For

- Making changes to campaigns automatically
- Bid adjustments without manual approval
- Creating or deleting campaigns
- Any write operations without explicit client authorization

---

## 6. Data Security & Privacy

### 6.1 Authentication & Authorization

| Security Measure | Implementation |
|------------------|----------------|
| OAuth 2.0 | Industry-standard authentication |
| Token Storage | Encrypted at rest (AES-256) |
| Access Control | Role-based permissions per client |
| Session Management | Secure, HTTP-only cookies |

### 6.2 Data Protection

- **Encryption in Transit:** TLS 1.3 for all connections
- **Encryption at Rest:** AES-256 database encryption
- **Data Retention:** Configurable per client (default: 24 months)
- **Data Isolation:** Each client can only access their own data

### 6.3 GDPR Compliance

As a Spanish company, we fully comply with GDPR:
- Data processing agreements with all clients
- Right to data portability and deletion
- Privacy policy clearly documented
- Data stored in EU data centers

---

## 7. User Interface Mockups

### 7.1 Dashboard Overview
The main dashboard displays key performance indicators:
- Total spend vs. budget
- Conversion metrics (leads, sales)
- ROAS and CPA trends
- Campaign status overview

### 7.2 Report View
Automated reports include:
- Executive summary with AI-generated insights
- Detailed performance tables
- Trend charts and visualizations
- Recommendations for optimization

### 7.3 Client Access
Clients receive:
- Read-only access to their reports
- Shareable public links with expiration
- Email notifications for new reports

---

## 8. Implementation Timeline

| Phase | Description | Duration |
|-------|-------------|----------|
| Phase 1 | OAuth integration & authentication | 2 weeks |
| Phase 2 | Campaign & metrics data retrieval | 2 weeks |
| Phase 3 | Dashboard visualization | 2 weeks |
| Phase 4 | Automated report generation | 2 weeks |
| Phase 5 | Testing & client rollout | 2 weeks |

---

## 9. Support & Maintenance

### 9.1 Contact Information

| Role | Contact |
|------|---------|
| Technical Lead | nicola.picasso@somosinapsis.com |
| Company Website | https://sinapsis.agency |

### 9.2 Compliance Commitment

We commit to:
- Following all Google Ads API Terms of Service
- Implementing required disclosures for clients
- Maintaining up-to-date API client libraries
- Responding promptly to any compliance requests

---

## 10. Appendix

### 10.1 Terms of Service Compliance

We acknowledge and agree to:
- Google Ads API Terms and Conditions
- Google API Services User Data Policy
- Required Minimum Functionality

### 10.2 No Reselling

This tool is exclusively for internal use by Somos Sinapsis SL to service our direct clients. We do not:
- Resell API access to third parties
- Provide this tool as a commercial product
- Allow access to non-clients

---

**Document prepared by:** Somos Sinapsis SL
**Date:** March 2026
**For:** Google Ads API Basic Access Application
