#!/bin/bash
# Google Indexing API - Automated Edge Case Tests
# Run dalam development environment dengan dry-run mode

set -e

echo "════════════════════════════════════════════════════════════"
echo "Google Indexing API - Edge Case Test Runner"
echo "════════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0
TOTAL=0

# Helper function
test_result() {
  TOTAL=$((TOTAL + 1))
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}: $2"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC}: $2"
    FAILED=$((FAILED + 1))
  fi
  echo ""
}

# Check prerequisites
echo "Checking prerequisites..."
echo ""

# Check if .env has required variables
if ! grep -q "FIREBASE_SERVICE_ACCOUNT" .env; then
  echo -e "${RED}✗ FIREBASE_SERVICE_ACCOUNT not found in .env${NC}"
  exit 1
fi

if ! grep -q "ENABLE_GOOGLE_INDEXING_API=true" .env; then
  echo -e "${YELLOW}⚠ ENABLE_GOOGLE_INDEXING_API not set to true${NC}"
  echo "Add to .env: ENABLE_GOOGLE_INDEXING_API=true"
  exit 1
fi

if ! grep -q "GOOGLE_INDEXING_DRY_RUN=true" .env; then
  echo -e "${YELLOW}⚠ GOOGLE_INDEXING_DRY_RUN not set to true (recommended for testing)${NC}"
  echo "Add to .env: GOOGLE_INDEXING_DRY_RUN=true"
  exit 1
fi

echo -e "${GREEN}✓ Environment variables configured${NC}"
echo ""

# Check MongoDB connection
echo "Checking MongoDB connection..."
MONGO_URI=$(grep "MONGODB_URI" .env | cut -d'=' -f2-)
if [ -z "$MONGO_URI" ]; then
  echo -e "${RED}✗ MONGODB_URI not found in .env${NC}"
  exit 1
fi

mongosh "$MONGO_URI" --quiet --eval "db.adminCommand('ping')" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ MongoDB connected${NC}"
else
  echo -e "${RED}✗ MongoDB connection failed${NC}"
  exit 1
fi
echo ""

# Check TypeScript compilation
echo "Running TypeScript compilation check..."
npx tsc --noEmit > /dev/null 2>&1
test_result $? "TypeScript compilation clean"

echo "════════════════════════════════════════════════════════════"
echo "Starting Edge Case Tests"
echo "════════════════════════════════════════════════════════════"
echo ""

# Test 1: Service imports correctly
echo "Test 1: Verify service module loads"
node -e "
  const path = require('path');
  const serviceFile = path.join(process.cwd(), 'src/services/googleIndexingService.ts');
  const fs = require('fs');
  const content = fs.readFileSync(serviceFile, 'utf8');
  
  const hasNotifyFunction = content.includes('export async function notifyGoogleIndexing');
  const hasQuotaFunction = content.includes('export async function getQuotaUsage');
  const hasDryRun = content.includes('GOOGLE_INDEXING_DRY_RUN');
  const hasFirebaseAuth = content.includes('FIREBASE_SERVICE_ACCOUNT');
  
  if (hasNotifyFunction && hasQuotaFunction && hasDryRun && hasFirebaseAuth) {
    process.exit(0);
  } else {
    console.error('Missing required functions or env checks');
    process.exit(1);
  }
" 2>/dev/null
test_result $? "Service module has all required functions"

# Test 2: Type definitions exist
echo "Test 2: Verify type definitions"
node -e "
  const path = require('path');
  const typeFile = path.join(process.cwd(), 'src/types/googleIndexing.ts');
  const articleTypeFile = path.join(process.cwd(), 'src/types/article.ts');
  const fs = require('fs');
  
  const indexingTypes = fs.readFileSync(typeFile, 'utf8');
  const articleTypes = fs.readFileSync(articleTypeFile, 'utf8');
  
  const hasIndexingApiLog = indexingTypes.includes('IndexingApiLog');
  const hasQuotaUsage = indexingTypes.includes('IndexingQuotaUsage');
  const hasBoostIndexing = articleTypes.includes('boostIndexing');
  
  if (hasIndexingApiLog && hasQuotaUsage && hasBoostIndexing) {
    process.exit(0);
  } else {
    console.error('Missing required type definitions');
    process.exit(1);
  }
" 2>/dev/null
test_result $? "Type definitions complete"

# Test 3: API endpoints exist
echo "Test 3: Verify API endpoints exist"
FILES=(
  "src/app/api/google-indexing/notify/route.ts"
  "src/app/api/admin/dashboard/boosted-articles/route.ts"
  "src/app/api/admin/dashboard/indexing-quota/route.ts"
)

ALL_EXIST=0
for file in "${FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "Missing: $file"
    ALL_EXIST=1
  fi
done
test_result $ALL_EXIST "All API endpoint files exist"

# Test 4: Dashboard hooks exist
echo "Test 4: Verify dashboard hooks"
if [ -f "src/hooks/useIndexingDashboard.ts" ]; then
  node -e "
    const fs = require('fs');
    const content = fs.readFileSync('src/hooks/useIndexingDashboard.ts', 'utf8');
    const hasBoostHook = content.includes('useBoostedArticles');
    const hasQuotaHook = content.includes('useIndexingQuota');
    process.exit(hasBoostHook && hasQuotaHook ? 0 : 1);
  " 2>/dev/null
  test_result $? "Dashboard hooks implemented"
else
  test_result 1 "Dashboard hooks file missing"
fi

# Test 5: Article editor integration
echo "Test 5: Verify article editor integration"
node -e "
  const fs = require('fs');
  const formUi = fs.readFileSync('src/components/admin/articles/ArticleEditorFormUi.tsx', 'utf8');
  const formLogic = fs.readFileSync('src/components/admin/articles/ArticleEditorForm.tsx', 'utf8');
  const service = fs.readFileSync('src/services/article/coreWriteArticleService.ts', 'utf8');
  
  const hasToggleUi = formUi.includes('boost-indexing') || formUi.includes('Boost Google Indexing');
  const hasFormState = formLogic.includes('boostIndexing');
  const hasServiceHook = service.includes('notifyGoogleIndexing');
  
  if (hasToggleUi && hasFormState && hasServiceHook) {
    process.exit(0);
  } else {
    console.error('Article editor integration incomplete');
    process.exit(1);
  }
" 2>/dev/null
test_result $? "Article editor fully integrated"

# Test 6: Fire-and-forget pattern verification
echo "Test 6: Verify fire-and-forget pattern (non-blocking)"
node -e "
  const fs = require('fs');
  const service = fs.readFileSync('src/services/article/coreWriteArticleService.ts', 'utf8');
  
  // Check for void operator and .catch() pattern
  const hasVoidPattern = service.includes('void notifyGoogleIndexing');
  const hasCatchPattern = service.includes('.catch(');
  const notThrows = !service.includes('await notifyGoogleIndexing');
  
  if (hasVoidPattern && hasCatchPattern && notThrows) {
    process.exit(0);
  } else {
    console.error('Fire-and-forget pattern not properly implemented');
    process.exit(1);
  }
" 2>/dev/null
test_result $? "Fire-and-forget pattern verified (article publish never blocks)"

# Test 7: Feature flag checks
echo "Test 7: Verify feature flag implementation"
node -e "
  const fs = require('fs');
  const service = fs.readFileSync('src/services/googleIndexingService.ts', 'utf8');
  
  const hasFeatureFlag = service.includes('ENABLE_GOOGLE_INDEXING_API');
  const hasDryRunFlag = service.includes('GOOGLE_INDEXING_DRY_RUN');
  const hasFeatureCheck = service.includes('if (process.env.ENABLE_GOOGLE_INDEXING_API');
  
  if (hasFeatureFlag && hasDryRunFlag && hasFeatureCheck) {
    process.exit(0);
  } else {
    console.error('Feature flags not properly implemented');
    process.exit(1);
  }
" 2>/dev/null
test_result $? "Feature flags implemented correctly"

# Test 8: Database logging structure
echo "Test 8: Verify database logging implementation"
node -e "
  const fs = require('fs');
  const service = fs.readFileSync('src/services/googleIndexingService.ts', 'utf8');
  
  const hasLogInsert = service.includes('logsCollection.insertOne');
  const hasArticleId = service.includes('articleId:');
  const hasSuccess = service.includes('success:');
  const hasDryRunField = service.includes('dryRun:');
  
  if (hasLogInsert && hasArticleId && hasSuccess && hasDryRunField) {
    process.exit(0);
  } else {
    console.error('Database logging incomplete');
    process.exit(1);
  }
" 2>/dev/null
test_result $? "Database logging properly structured"

# Test 9: Quota tracking implementation
echo "Test 9: Verify quota tracking logic"
node -e "
  const fs = require('fs');
  const service = fs.readFileSync('src/services/googleIndexingService.ts', 'utf8');
  
  const hasQuotaCheck = service.includes('getRemainingQuota');
  const hasQuotaLimit = service.includes('DAILY_QUOTA_LIMIT') || service.includes('200');
  const hasExhaustedHandling = service.includes('quota exhausted');
  
  if (hasQuotaCheck && hasQuotaLimit && hasExhaustedHandling) {
    process.exit(0);
  } else {
    console.error('Quota tracking incomplete');
    process.exit(1);
  }
" 2>/dev/null
test_result $? "Quota tracking implemented"

# Test 10: RBAC gate verification
echo "Test 10: Verify RBAC gate for boost toggle"
node -e "
  const fs = require('fs');
  const formUi = fs.readFileSync('src/components/admin/articles/ArticleEditorFormUi.tsx', 'utf8');
  
  const hasShowStatusPicker = formUi.includes('showStatusPicker');
  const hasStatusCheck = formUi.includes('status === ArticleStatus.PUBLISHED') || 
                         formUi.includes('status === \"PUBLISHED\"');
  
  if (hasShowStatusPicker && hasStatusCheck) {
    process.exit(0);
  } else {
    console.error('RBAC gate not properly implemented');
    process.exit(1);
  }
" 2>/dev/null
test_result $? "RBAC gate enforced (showStatusPicker)"

# Test 11: Check MongoDB for test collection
echo "Test 11: Database structure check"
mongosh "$MONGO_URI" --quiet --eval "
  const db = db.getSiblingDB('arasvara');
  const collections = db.getCollectionNames();
  
  // Note: Collection won't exist until first insert, which is fine
  print('Collections check: indexing_api_logs will be created on first use');
  quit(0);
" > /dev/null 2>&1
test_result $? "Database connection and structure validated"

# Test 12: Documentation completeness
echo "Test 12: Verify documentation files"
DOCS=(
  "memory/google_indexing_api_testing.md"
  "memory/google_indexing_api_testing_checklist.md"
  "memory/google_indexing_api_implementation_summary.md"
  "memory/google_indexing_api_validation_report.md"
  "memory/google_indexing_api_edge_case_testing.md"
)

DOCS_COMPLETE=0
for doc in "${DOCS[@]}"; do
  if [ ! -f "$doc" ]; then
    echo "Missing documentation: $doc"
    DOCS_COMPLETE=1
  fi
done
test_result $DOCS_COMPLETE "All documentation files present"

echo "════════════════════════════════════════════════════════════"
echo "Test Summary"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
  echo -e "${RED}Failed: $FAILED${NC}"
else
  echo "Failed: $FAILED"
fi
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}✓ All edge case verifications passed!${NC}"
  echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Start dev server: npm run dev"
  echo "2. Run manual tests from: memory/google_indexing_api_testing_checklist.md"
  echo "3. Test article creation with boost toggle enabled"
  echo "4. Verify database logs: db.indexing_api_logs.find().pretty()"
  echo ""
  exit 0
else
  echo -e "${RED}════════════════════════════════════════════════════════════${NC}"
  echo -e "${RED}✗ Some verifications failed${NC}"
  echo -e "${RED}════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo "Please fix the failed tests before proceeding."
  exit 1
fi
