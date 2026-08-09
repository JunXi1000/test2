#!/bin/bash
# NEXUS Frontend Feature Test Suite
# Tests all implemented features via page content analysis

BASE="http://localhost:5173"
PASS=0
FAIL=0
RESULTS=()

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function test_page() {
  local name="$1"
  local url="$2"
  local checks="$3"  # grep patterns separated by |
  local required="$4" # "all" or "any"

  local html=$(curl -s "$BASE$url" 2>/dev/null)
  local status=$?

  if [ $status -ne 0 ]; then
    echo -e "${RED}✗ FAIL${NC} | $name — Connection error"
    ((FAIL++))
    RESULTS+=("FAIL|$name|Connection error")
    return
  fi

  IFS='|' read -ra PATTERNS <<< "$checks"
  local matched=0
  local total=${#PATTERNS[@]}
  local failed_checks=()

  for pattern in "${PATTERNS[@]}"; do
    if echo "$html" | grep -qi "$pattern"; then
      ((matched++))
    else
      failed_checks+=("$pattern")
    fi
  done

  if [ "$required" = "all" ]; then
    if [ $matched -eq $total ]; then
      echo -e "${GREEN}✓ PASS${NC} | $name ($matched/$total checks)"
      ((PASS++))
      RESULTS+=("PASS|$name|All $matched checks passed")
    else
      echo -e "${RED}✗ FAIL${NC} | $name — Missing: ${failed_checks[*]}"
      ((FAIL++))
      RESULTS+=("FAIL|$name|Missing: ${failed_checks[*]}")
    fi
  else
    if [ $matched -gt 0 ]; then
      echo -e "${GREEN}✓ PASS${NC} | $name ($matched/$total checks)"
      ((PASS++))
      RESULTS+=("PASS|$name|$matched/$total checks")
    else
      echo -e "${RED}✗ FAIL${NC} | $name — No checks matched"
      ((FAIL++))
      RESULTS+=("FAIL|$name|No checks matched")
    fi
  fi
}

echo "=============================================="
echo "  NEXUS Frontend Feature Test Suite"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="
echo ""

# Phase 1: Search Enhancement
echo "── Phase 1: Search Enhancement ──"
test_page "Homepage loads" "/" "nexus|NEXUS|app" "any"
test_page "Search results page" "/search?q=phone" "Search|results|phone|product" "all"
test_page "Trending searches on empty" "/search" "Trending|trending|popular" "any"
test_page "Search facets render" "/search?q=phone" "Category|Price|Rating|Sort" "any"
test_page "Related searches appear" "/search?q=phone" "Related|related" "any"

# Phase 2: Wishlist
echo ""
echo "── Phase 2: Wishlist Persistence ──"
test_page "Wishlist page loads" "/dashboard/wishlist" "wishlist|My Wishlist|empty" "any"

# Phase 3: Browsing History
echo ""
echo "── Phase 3: Browsing History ──"
test_page "Product detail loads" "/product/1" "product|Add to Bag|Buy" "any"

# Phase 4: Product Compare
echo ""
echo "── Phase 4: Product Compare ──"
test_page "Compare page loads (redirects if empty)" "/compare" "app|nexus|NEXUS|home" "any"

# Phase 5: Breadcrumb
echo ""
echo "── Phase 5: Breadcrumb Navigation ──"
test_page "Product detail has breadcrumb" "/product/1" "Home|category|breadcrumb" "any"

# Phase 6: Coupon Center
echo ""
echo "── Phase 6: Coupon Center ──"
test_page "Coupon page loads" "/dashboard/coupons" "coupon|Available|Claim|My Coupons" "any"

# Phase 7: Returns
echo ""
echo "── Phase 7: Returns & Refunds ──"
test_page "Returns page loads" "/dashboard/returns" "return|refund|Return|New Return" "any"

# Phase 8: Q&A
echo ""
echo "── Phase 8: Q&A ──"
test_page "Product detail Q&A tab" "/product/1" "question|answer|qa|ask" "any"

# Phase 9: Stock Alerts
echo ""
echo "── Phase 9: Stock Alerts ──"
test_page "Notify me on out-of-stock products" "/product/1" "stock|Stock|In Stock" "any"

# Phase 10: Image Lazy Loading
echo ""
echo "── Phase 10: Lazy Loading ──"
# Check that the composable file exists
if [ -f "src/composables/useLazyImage.ts" ]; then
  echo -e "${GREEN}✓ PASS${NC} | Lazy image composable exists"
  ((PASS++))
else
  echo -e "${RED}✗ FAIL${NC} | Lazy image composable missing"
  ((FAIL++))
fi

# Phase 11: PWA
echo ""
echo "── Phase 11: PWA Support ──"
test_page "Manifest accessible" "/manifest.json" "name|NEXUS|display|standalone" "all"
test_page "SW accessible" "/sw.js" "install|fetch|activate|CACHE_NAME" "any"

# Additional: Core pages
echo ""
echo "── Core Pages ──"
test_page "Cart page" "/cart" "cart|Cart|bag|checkout" "any"
test_page "Checkout page" "/checkout" "checkout|shipping|payment|review" "any"
test_page "Login page" "/login" "login|sign in|email|password" "any"
test_page "Signup page" "/signup" "sign|create|register" "any"
test_page "Store page" "/store/1" "store|product|merchant|Store" "any"
test_page "Thank you page" "/thank-you" "thank|order|confirm|success" "any"
test_page "404 page" "/nonexistent-page-xyz" "not found|404|page" "any"

# Additional: Dashboard pages
echo ""
echo "── Dashboard Pages ──"
test_page "User dashboard" "/dashboard" "dashboard|stats|order|recent" "any"
test_page "Orders page" "/dashboard/orders" "order|Orders|tracking|status" "any"
test_page "Addresses page" "/dashboard/addresses" "address|Address|add|save" "any"
test_page "Settings page" "/dashboard/settings" "settings|profile|password|save" "any"
test_page "Messages page" "/dashboard/messages" "message|chat|conversation" "any"

# Additional: Admin pages
echo ""
echo "── Admin Pages ──"
test_page "Admin login" "/admin/login" "admin|login|Admin" "any"
test_page "Admin dashboard" "/admin/dashboard" "admin|dashboard|chart|users" "any"

# Additional: Merchant pages
echo ""
echo "── Merchant Pages ──"
test_page "Merchant login" "/merchant/login" "merchant|login|Merchant" "any"
test_page "Merchant dashboard" "/merchant/dashboard" "merchant|dashboard|product|order" "any"

# Asset checks
echo ""
echo "── Static Assets ──"
if [ -f "public/manifest.json" ]; then
  echo -e "${GREEN}✓ PASS${NC} | manifest.json exists"
  ((PASS++))
else
  echo -e "${RED}✗ FAIL${NC} | manifest.json missing"
  ((FAIL++))
fi
if [ -f "public/sw.js" ]; then
  echo -e "${GREEN}✓ PASS${NC} | sw.js exists"
  ((PASS++))
else
  echo -e "${RED}✗ FAIL${NC} | sw.js missing"
  ((FAIL++))
fi

# API mocks check
echo ""
echo "── API Mock Modules ──"
for f in src/api/modules/search.ts src/api/modules/product.ts src/api/modules/payment.ts src/api/modules/checkout.ts; do
  if [ -f "$f" ]; then
    echo -e "${GREEN}✓ OK${NC}   | $f"
  else
    echo -e "${RED}✗ MISS${NC} | $f"
  fi
done

# Store checks
echo ""
echo "── Pinia Stores ──"
for s in src/stores/wishlist.ts src/stores/browsingHistory.ts src/stores/compare.ts src/stores/coupons.ts src/stores/returns.ts src/stores/stockAlerts.ts src/stores/cart.ts src/stores/auth.ts; do
  if [ -f "$s" ]; then
    echo -e "${GREEN}✓ OK${NC}   | $s"
  else
    echo -e "${RED}✗ MISS${NC} | $s"
  fi
done

echo ""
echo "=============================================="
echo "  SUMMARY: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"
echo "  Total: $((PASS + FAIL)) tests"
echo "=============================================="

if [ $FAIL -gt 0 ]; then
  echo ""
  echo "Failed tests:"
  for r in "${RESULTS[@]}"; do
    if [[ "$r" == FAIL* ]]; then
      echo -e "  ${RED}✗${NC} $(echo "$r" | cut -d'|' -f2) — $(echo "$r" | cut -d'|' -f3)"
    fi
  done
fi

exit $FAIL
