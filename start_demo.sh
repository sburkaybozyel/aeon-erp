#!/bin/bash
# Starts the real AEON ERP with the CRM bridge enabled (modules/crm_bridge.js).
# Must use the SAME CRM_BRIDGE_KEY value as crm/start_demo.sh's ERP_API_KEY.
export CRM_BRIDGE_KEY="16-cc5bk3beK2lIY_psBoNtn2-bwFIIY"
cd "$(dirname "$0")"
node server.js
