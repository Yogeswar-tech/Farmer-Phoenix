"""Google Sheets storage integration for recording daily mandi prices audit trail."""

import csv
import logging
from pathlib import Path
from typing import Any

from google.oauth2 import service_account
from googleapiclient.discovery import build  # type: ignore[import-untyped]

from app.ingestion.models import MandiPriceRecord
from app.settings import settings

logger = logging.getLogger(__name__)

HEADERS = [
    "Date",
    "State",
    "District",
    "Market",
    "Commodity",
    "Variety",
    "Min Price (₹/qtl)",
    "Max Price (₹/qtl)",
    "Modal Price (₹/qtl)",
    "Source",
]


class GoogleSheetsWriter:
    """Writes fetched mandi price records to Google Sheets as a structured audit trail."""

    def __init__(
        self,
        spreadsheet_id: str | None = None,
        service_account_path: str | None = None,
        sheet_name: str = "daily_prices",
    ) -> None:
        self.spreadsheet_id = spreadsheet_id or settings.google_sheets_spreadsheet_id
        self.service_account_path = service_account_path or settings.google_service_account_path
        self.sheet_name = sheet_name
        self._service: Any = None

    def _get_service(self) -> Any:
        """Lazily initialize Google Sheets API client."""
        if self._service is not None:
            return self._service

        if not self.service_account_path:
            raise ValueError(
                "Missing service account path. Please set KS_GOOGLE_SERVICE_ACCOUNT_PATH."
            )

        key_file = Path(self.service_account_path)
        if not key_file.exists():
            raise FileNotFoundError(f"Service account file not found: {self.service_account_path}")

        scopes = ["https://www.googleapis.com/auth/spreadsheets"]
        credentials = service_account.Credentials.from_service_account_file(  # type: ignore[no-untyped-call]
            str(key_file), scopes=scopes
        )
        self._service = build("sheets", "v4", credentials=credentials)
        return self._service

    def append_prices(
        self,
        records: list[MandiPriceRecord],
        local_csv_fallback: bool = True,
    ) -> int:
        """Append price records to the spreadsheet.

        Falls back to local CSV output if Google Sheets credentials are not configured.
        """
        if not records:
            logger.info("No records to append.")
            return 0

        # Build rows to insert
        rows: list[list[Any]] = [
            [
                r.arrival_date,
                r.state,
                r.district,
                r.market,
                r.commodity,
                r.variety,
                r.min_price,
                r.max_price,
                r.modal_price,
                r.source,
            ]
            for r in records
        ]

        if not self.spreadsheet_id or not self.service_account_path:
            if local_csv_fallback:
                return self._write_local_csv(rows)
            raise ValueError("Google Sheets credentials or Spreadsheet ID not configured.")

        try:
            service = self._get_service()
            range_name = f"{self.sheet_name}!A:J"

            # Check if sheet is empty to write headers
            read_result = (
                service.spreadsheets()
                .values()
                .get(spreadsheetId=self.spreadsheet_id, range=f"{self.sheet_name}!A1:J1")
                .execute()
            )
            existing_values = read_result.get("values", [])

            if not existing_values:
                # Insert header
                service.spreadsheets().values().append(
                    spreadsheetId=self.spreadsheet_id,
                    range=range_name,
                    valueInputOption="RAW",
                    body={"values": [HEADERS]},
                ).execute()

            # Append the data rows
            body = {"values": rows}
            response = (
                service.spreadsheets()
                .values()
                .append(
                    spreadsheetId=self.spreadsheet_id,
                    range=range_name,
                    valueInputOption="USER_ENTERED",
                    insertDataOption="INSERT_ROWS",
                    body=body,
                )
                .execute()
            )

            updates = response.get("updates", {})
            updated_rows = updates.get("updatedRows", len(rows))
            logger.info(
                "Successfully appended %s rows to Google Sheet %s",
                updated_rows,
                self.spreadsheet_id,
            )
            return int(updated_rows)

        except Exception as exc:
            logger.error("Failed to write to Google Sheets: %s", exc)
            if local_csv_fallback:
                logger.info("Falling back to local CSV file backup.")
                return self._write_local_csv(rows)
            raise

    def _write_local_csv(self, rows: list[list[Any]]) -> int:
        """Write records to local CSV file (data/seed/mandi_prices_audit.csv)."""
        backup_dir = Path("data") / "seed"
        backup_dir.mkdir(parents=True, exist_ok=True)
        csv_path = backup_dir / "mandi_prices_audit.csv"

        file_exists = csv_path.exists()
        with open(csv_path, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(HEADERS)
            writer.writerows(rows)

        logger.info("Saved %d records to local audit CSV: %s", len(rows), csv_path)
        return len(rows)
