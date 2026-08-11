#!/bin/bash
# Starts the CRM pointed at the REAL AEON ERP (aeon/, port 3000) instead of its own sandbox.
# CRM_ERP_DISABLE=true stops crm/erp_server.js (the fake sandbox) from starting at all.
# ERP_API_KEY must match aeon/start_demo.sh's CRM_BRIDGE_KEY.
export CRM_ERP_DISABLE=true
export ERP_API_URL="http://localhost:3000/api/erp"
export ERP_API_KEY="16-cc5bk3beK2lIY_psBoNtn2-bwFIIY"
cd "$(dirname "$0")"
node server.js
