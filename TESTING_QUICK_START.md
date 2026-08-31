# Quick Start Guide - Google Indexing API Testing

## Prerequisites

1. **Environment Variables** (add to `.env`):
```bash
ENABLE_GOOGLE_INDEXING_API=true
GOOGLE_INDEXING_DRY_RUN=true  # Safe mode - recommended for first tests
```

2. **Verify Setup**:
```bash
# Run automated verification
./scripts/test-indexing-api-edge-cases.sh
```

## Testing Flow

### Phase 1: Automated Verification (5 minutes)
```bash
# Run verification script
cd /home/padli/Projects/arasvara
./scripts/test-indexing-api-edge-cases.sh
```

**Expected Output**:
```
✓ TypeScript compilation clean
✓ Service module has all required functions
✓ Type definitions complete
✓ All API endpoint files exist
✓ Dashboard hooks implemented
✓ Article editor fully integrated
✓ Fire-and-forget pattern verified
✓ Feature flags implemented correctly
✓ Database logging properly structured
✓ Quota tracking implemented
✓ RBAC gate enforced
✓ Database connection validated
✓ All documentation files present

Total Tests: 12
Passed: 12
Failed: 0
```

### Phase 2: Manual UI Testing (15 minutes)

**Test 1: Basic Article Creation**
1. Start dev server: `npm run dev`
2. Login ke admin panel: `http://localhost:3000/admin-xyz`
3. Go to: `http://localhost:3000/admin-xyz/articles/new`
4. Fill form:
   - Title: "Test Google Indexing API"
   - Content: Any text
   - Category: Select any
   - Featured image: Upload any
5. Set status: **PUBLISHED**
6. **Verify**: Boost toggle appears below metadata
7. Enable "Boost Google Indexing" toggle
8. Click **Submit**
9. **Verify**: Article published successfully

**Verification Steps**:
```bash
# Check server logs
# Should see: "[DRY RUN] Google Indexing API dry-run mode"

# Check MongoDB
mongosh
use arasvara
db.indexing_api_logs.find().sort({requestedAt: -1}).limit(1).pretty()

# Expected output:
{
  _id: ObjectId("..."),
  articleId: ObjectId("..."),
  url: "https://arasvara.id/...",
  type: "URL_UPDATED",
  requestedAt: ISODate("..."),
  requestedBy: ObjectId("..."),
  success: true,
  dryRun: true,
  quotaRemaining: 200
}
```

**Test 2: Dashboard Verification**
1. Go to: `http://localhost:3000/admin-xyz/dashboard`
2. Scroll to "Artikel yang Di-Boost" section
3. **Verify**: Shows test article with "Boosted" badge
4. **Verify**: Quota display shows "1 / 200"

**Test 3: Status Transition**
1. Create new article with status **DRAFT**
2. **Verify**: Boost toggle TIDAK muncul
3. Change status to **PUBLISHED**
4. **Verify**: Boost toggle MUNCUL
5. Enable toggle and submit
6. **Verify**: Article published with boost

### Phase 3: Edge Case Testing (30 minutes)

Follow comprehensive guide:
```bash
cat memory/google_indexing_api_edge_case_testing.md
```

**Critical Tests**:
- Test 5: Quota boundary (simulate 200/200)
- Test 8: Missing credentials (error handling)
- Test 13: RBAC enforcement (Writer role)
- Test 16: Dashboard empty state

### Phase 4: Real API Test (Optional, 10 minutes)

⚠️ **Only if ready for production testing**

1. **Switch to real mode**:
```bash
# In .env
GOOGLE_INDEXING_DRY_RUN=false
```

2. **Restart server**:
```bash
npm run dev
```

3. **Create ONE test article**:
   - Enable boost toggle
   - Submit
   - Check server logs for "Google Indexing API: success"

4. **Verify in Google Search Console**:
   - Wait 5-10 minutes
   - Go to: https://search.google.com/search-console
   - URL Inspection → Check test article URL
   - Should see indexing request logged

5. **Switch back to dry-run**:
```bash
# In .env
GOOGLE_INDEXING_DRY_RUN=true
```

## Quick Edge Case Checklist

### Must-Test Scenarios
- [ ] Article with boost enabled (basic flow)
- [ ] Article without boost (control)
- [ ] Status transition (DRAFT → PUBLISHED)
- [ ] Dashboard shows boosted articles
- [ ] Quota display accurate
- [ ] Feature flag disable (`ENABLE_GOOGLE_INDEXING_API=false`)
- [ ] Edit existing article (boost toggle persists)
- [ ] RBAC gate (Writer can't see toggle)

### Optional But Recommended
- [ ] Rapid submit (spam click)
- [ ] Concurrent requests (multiple editors)
- [ ] Quota boundary (199, 200, 201)
- [ ] Missing credentials (error handling)
- [ ] Dashboard empty state

## Success Criteria

✅ **Ready for Production** when:
1. All automated tests pass (12/12)
2. Manual UI tests work correctly (3/3)
3. At least 5 edge cases tested successfully
4. Article publish NEVER blocks (even on errors)
5. Dashboard displays data correctly
6. Quota tracking accurate

## Common Issues

### Issue: Boost toggle tidak muncul
**Solution**: Check status is PUBLISHED or SCHEDULED, dan user punya permission (Editor/Admin)

### Issue: Server logs "Feature disabled"
**Solution**: Set `ENABLE_GOOGLE_INDEXING_API=true` di `.env`

### Issue: No log entry di database
**Solution**: 
- Check boost toggle WAS enabled saat submit
- Check server logs untuk error
- Verify MongoDB connection

### Issue: Dashboard tidak update
**Solution**: Refresh page (no real-time updates implemented)

### Issue: "FIREBASE_SERVICE_ACCOUNT required" error
**Solution**: Env var sudah ada, tapi mungkin format salah. Re-check base64 encoding.

## Time Estimates

| Phase | Duration | Can Skip? |
|-------|----------|-----------|
| Automated verification | 5 min | No |
| Manual UI testing | 15 min | No |
| Edge case testing | 30 min | Partially (do critical tests) |
| Real API test | 10 min | Yes (optional) |
| **Total** | **60 min** | **Minimum: 20 min** |

## Monitoring After Deployment

### Daily (First Week)
```bash
# Check error logs
tail -f logs/app.log | grep "indexing"

# Check quota usage
mongosh
use arasvara
db.indexing_api_logs.find({
  requestedAt: {$gte: new Date(new Date().setHours(0,0,0,0))}
}).count()
```

### Weekly (First Month)
- Review Google Search Console for indexing speed improvements
- Compare boosted vs non-boosted article indexing times
- Check quota consumption trend
- Verify no edge cases causing issues

## Rollback Plan

If critical issue found:

1. **Immediate disable**:
```bash
# In .env
ENABLE_GOOGLE_INDEXING_API=false
```

2. **Restart server**:
```bash
pm2 restart arasvara  # or your process manager
```

3. **Verify articles still publish** without boost

4. **No data cleanup needed** (feature is additive, logs are isolated)

## Support

**Documentation**:
- Implementation: `memory/google_indexing_api_implementation_summary.md`
- Testing guide: `memory/google_indexing_api_testing.md`
- Edge cases: `memory/google_indexing_api_edge_case_testing.md`
- Validation: `memory/google_indexing_api_validation_report.md`

**Quick Reference**:
```bash
# Start dev server
npm run dev

# Run automated tests
./scripts/test-indexing-api-edge-cases.sh

# Check MongoDB logs
mongosh
use arasvara
db.indexing_api_logs.find().sort({requestedAt: -1}).limit(10).pretty()

# Check quota
db.indexing_api_logs.find({
  requestedAt: {$gte: new Date(new Date().setHours(0,0,0,0))},
  success: true,
  dryRun: false
}).count()
```

## Next Steps After Testing

1. ✅ All tests passed → Add env vars to production
2. ✅ Deploy with `GOOGLE_INDEXING_DRY_RUN=true` first
3. ✅ Monitor 24 hours
4. ✅ Switch to `GOOGLE_INDEXING_DRY_RUN=false`
5. ✅ Monitor Google Search Console for improvements
6. ✅ Gradually increase usage volume
7. ✅ Request quota increase from Google if needed (>200/day)
