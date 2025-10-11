# Tenant Filtering Implementation Plan

## ⚠️ CRITICAL ISSUE IDENTIFIED

### The Problem:
- **Current MedEx Users**: 0 (zero users with tenant_id='medex')
- **RLS Policies**: Already active and enforcing tenant isolation
- **Risk**: Adding `.eq('tenant_id', 'medex')` to authentication queries when there are NO MedEx users will **break login completely**

### The Catch-22:
1. Can't add tenant filtering without breaking login (no users to authenticate)
2. Can't test tenant filtering without a MedEx user
3. User asked not to create Cheryl yet

---

## 🛡️ SAFE IMPLEMENTATION STRATEGY

### Phase 1: Create First MedEx User (REQUIRED)
**Status**: ⏳ BLOCKED - Waiting for user approval

**Options:**
1. **Option A**: Create Cheryl now (user previously said wait)
2. **Option B**: Create a temporary test user
3. **Option C**: User creates first account via registration UI

**Recommendation**: Need at least ONE MedEx user before proceeding with code updates.

---

### Phase 2: Staged Code Updates (After User Created)

#### Stage 1: Non-Critical Services (Safe to update first)
**Low Risk - These don't affect login:**

1. ✅ `src/services/avatarStorageService.ts` - Avatar operations
2. ✅ `src/services/bulletproofProfileFieldsService.ts` - Profile fields
3. ✅ `src/services/enhancedCrossDeviceProfileSync.ts` - Sync service
4. ✅ `src/services/robustProfileSyncService.ts` - Sync service
5. ✅ `src/services/auditUserLookupService.ts` - Audit lookups

**Impact**: None - these services don't affect authentication

---

#### Stage 2: Settings & Configuration (Medium Risk)
**Medium Risk - Used after login:**

6. ✅ `src/services/userSettingsServiceEnhanced.ts` - User settings
7. ✅ `src/services/supabaseService.ts` - General Supabase operations

**Impact**: Minimal - only affects post-login functionality

---

#### Stage 3: Profile & User Management (Higher Risk)
**Higher Risk - Affects user data access:**

8. ⚠️ `src/services/userProfileService.ts` - Profile loading/updates
9. ⚠️ `src/services/userManagementService.ts` - User CRUD operations
10. ⚠️ `src/services/enhancedUserService.ts` - Enhanced user ops

**Impact**: Moderate - could affect profile loading, must test thoroughly

---

#### Stage 4: Authentication (CRITICAL - Do Last)
**CRITICAL RISK - Could break login:**

11. 🚨 `src/services/authService.ts` - Core authentication
12. 🚨 `src/contexts/AuthContext.tsx` - Auth context provider
13. 🚨 `src/services/authRecoveryService.ts` - Recovery flows
14. 🚨 `src/services/secureApiService.ts` - API security

**Impact**: CRITICAL - could lock users out, requires extensive testing

---

## 🧪 Testing Strategy

### Before Any Updates:
1. ✅ Verify RLS policies are active
2. ✅ Confirm tenant_id columns exist
3. ⏳ **REQUIRED**: Create first MedEx user

### After Each Stage:
1. Test login still works
2. Test user can access their data
3. Test user management functions
4. Verify CareXPS users are NOT visible

### Rollback Plan:
- Git commit before each stage
- Keep list of changed files
- Can revert individual files if needed

---

## 📝 Implementation Pattern

### Current Code (Without Tenant Filter):
```typescript
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('email', email)
```

### Updated Code (With Tenant Filter):
```typescript
import { getCurrentTenantId } from '@/config/tenantConfig'

const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('tenant_id', getCurrentTenantId())  // Add this line
  .eq('email', email)
```

### Using Helper Function (Preferred):
```typescript
import { withTenantFilter } from '@/config/tenantConfig'

const query = supabase.from('users').select('*').eq('email', email)
const { data, error } = await withTenantFilter(query)
```

---

## ⚠️ Files That Need Special Handling

### AuthService.ts - CRITICAL
**Lines to update with extreme care:**
- Line 17: User lookup by Azure AD ID
- Line 89: User lookup by email
- Line 149: User creation
- Line 165: User profile loading

**Testing required:**
- Azure AD login flow
- Email/password login
- User registration
- Session restoration

### UserManagementService.ts - HIGH RISK
**User creation must preserve tenant_id:**
- Ensure new users get `tenant_id='medex'`
- Verify super_user queries work
- Test user activation/deactivation

---

## 🎯 DECISION NEEDED FROM USER

**Before I can proceed safely, we need to:**

### Option 1: Create First MedEx User Now
- I'll create Cheryl with tenant_id='medex'
- Then proceed with staged code updates
- Can test each stage with real user

### Option 2: You Create First User via UI
- You register first user through the app
- I wait to update code until you confirm user exists
- Then proceed with updates

### Option 3: Create Temporary Test User
- I create `test@medex.com` with tenant_id='medex'
- Use for testing, delete after
- Then create Cheryl properly later

**Which option do you prefer?**

---

## 📊 Current Risk Assessment

| Risk Level | Description | Mitigation |
|------------|-------------|------------|
| 🟢 LOW | Non-auth services | Update first, easy rollback |
| 🟡 MEDIUM | Profile/settings services | Test thoroughly, staged rollout |
| 🔴 HIGH | Authentication services | Do last, extensive testing, have rollback ready |
| ⛔ CRITICAL | No MedEx users exist | **BLOCKER** - Must create user first |

---

## ✅ Safe Execution Checklist

- [ ] First MedEx user created and can log in
- [ ] Git commit before starting updates
- [ ] Update Stage 1 (non-critical services)
- [ ] Test: Login still works
- [ ] Update Stage 2 (settings/config)
- [ ] Test: User settings work
- [ ] Update Stage 3 (profile/user management)
- [ ] Test: Profile loading works
- [ ] Update Stage 4 (authentication) - LAST
- [ ] Test: Full authentication flow works
- [ ] Verify: CareXPS users are invisible
- [ ] Final: Comprehensive testing

---

**Ready to proceed once first MedEx user is created!**
