import sys
import time
import json
import os
sys.path.insert(0, 'd:/JobHunterLinkedin')

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from utilities.browser_setup import initialize_driver
from utilities.cookie_manager import login_with_cookies, cookies_exist
import config

OUTPUT_DIR = "d:/JobHunterLinkedin/test/extracted_jobs"
MAX_JOBS = 50

def ensure_output_dir():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        print(f"[INFO] Created output directory: {OUTPUT_DIR}")

def extract_job_detail_text(driver):
    try:
        detail_element = driver.find_element(By.CLASS_NAME, "scaffold-layout__detail")
        return detail_element.text
    except Exception as e:
        print(f"[WARNING] Could not extract detail text: {e}")
        return ""

def save_job_to_json(job_data, job_index):
    filename = f"{OUTPUT_DIR}/job_{job_index:03d}.json"
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(job_data, f, indent=2, ensure_ascii=False)
    print(f"[INFO] Saved: {filename}")

def get_job_cards(driver):
    try:
        cards = driver.find_elements(By.CSS_SELECTOR, "li.scaffold-layout__list-item")
        return cards
    except Exception:
        return []

def has_next_page(driver):
    try:
        next_btn = driver.find_element(By.XPATH, "//button[@aria-label='View next page']")
        return next_btn.is_enabled()
    except Exception:
        return False

def go_to_next_page(driver):
    try:
        next_btn = driver.find_element(By.XPATH, "//button[@aria-label='View next page']")
        next_btn.click()
        time.sleep(3)
        return True
    except Exception:
        return False

def test_job_extraction():
    driver = None
    total_extracted = 0
    
    try:
        print("=" * 50)
        print("TEST: Job Data Extraction")
        print("=" * 50)
        
        ensure_output_dir()
        
        print("\n[STEP 1] Initializing WebDriver...")
        driver = initialize_driver()
        
        print("\n[STEP 2] Authenticating with cookies...")
        if not cookies_exist():
            print("[ERROR] Cookie file not found")
            return
        
        login_with_cookies(driver)
        print("[INFO] Logged in successfully")
        
        print("\n[STEP 3] Navigating to job search page...")
        job_url = "https://www.linkedin.com/jobs/search/?currentJobId=4311333124&f_AL=true&geoId=102454443&keywords=Software%20Engineer&origin=JOB_SEARCH_PAGE_JOB_FILTER&refresh=true"
        driver.get(job_url)
        time.sleep(5)
        
        print("\n[STEP 4] Starting job extraction loop...")
        page_num = 1
        
        while total_extracted < MAX_JOBS:
            print(f"\n--- Page {page_num} ---")
            
            job_cards = get_job_cards(driver)
            print(f"[INFO] Found {len(job_cards)} job cards on page {page_num}")
            
            if len(job_cards) == 0:
                print("[WARNING] No job cards found, stopping")
                break
            
            for i, card in enumerate(job_cards):
                if total_extracted >= MAX_JOBS:
                    print(f"[INFO] Reached max limit of {MAX_JOBS} jobs")
                    break
                
                try:
                    print(f"\n[{total_extracted + 1}] Processing job card {i + 1}...")
                    
                    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", card)
                    time.sleep(0.5)
                    
                    card.click()
                    time.sleep(2)
                    
                    driver.execute_script("arguments[0].style.backgroundColor = '#90EE90'", card)
                    
                    detail_text = extract_job_detail_text(driver)
                    
                    job_data = {
                        "job_index": total_extracted + 1,
                        "page": page_num,
                        "card_index_on_page": i + 1,
                        "detail_text": detail_text,
                        "extracted_at": time.strftime("%Y-%m-%d %H:%M:%S")
                    }
                    
                    save_job_to_json(job_data, total_extracted + 1)
                    total_extracted += 1
                    
                except Exception as e:
                    print(f"[ERROR] Failed to process card {i + 1}: {e}")
                    continue
            
            if total_extracted >= MAX_JOBS:
                break
            
            if has_next_page(driver):
                print(f"\n[INFO] Going to next page...")
                if go_to_next_page(driver):
                    page_num += 1
                    time.sleep(3)
                else:
                    print("[INFO] Could not navigate to next page, stopping")
                    break
            else:
                print("[INFO] No more pages available")
                break
        
        print(f"\n{'=' * 50}")
        print(f"[SUCCESS] Extraction completed!")
        print(f"[INFO] Total jobs extracted: {total_extracted}")
        print(f"[INFO] Output directory: {OUTPUT_DIR}")
        print(f"{'=' * 50}")
        
        print("\n[STEP 5] Keeping browser open for 10 seconds to inspect...")
        time.sleep(10)
        
    except Exception as e:
        print(f"\n[ERROR] Test failed: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        if driver:
            print("\n[CLEANUP] Closing browser...")
            driver.quit()


if __name__ == "__main__":
    test_job_extraction()
