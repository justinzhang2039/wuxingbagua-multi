from flask import Flask, render_template, request, jsonify
from datetime import datetime, date, time, timedelta
import json
import os


app = Flask(__name__)

# ===============================
# BaZi (Four Pillars) Calculation
#
# This module implements a simplified BaZi calculator based on the classical
# Chinese sexagenary (Ganzhi) cycle.  The logic is adapted from open‑source
# Go projects that convert the Gregorian calendar to the four pillars of
# destiny.  Key formulas reference the day stem/branch calculations
# documented in the Bazica project【436278212403553†L17-L34】 as well as the
# Five Tigers rule for the month stem【283289781708604†L23-L29】 and the Five
# Rats rule for the hour stem【498096116057238†L18-L37】.  A few simplifying
# assumptions are made: instead of calculating exact solar terms from
# astronomical ephemerides, the month boundaries are approximated using
# fixed Gregorian dates (e.g. Start of Spring around February 4th).  Despite
# these approximations, the calculator produces a reasonable set of stems
# and branches for demonstration purposes.


# Heavenly stems and their corresponding elements and yin/yang properties
HEAVENLY_STEMS = [
    {"name": "甲", "element": "木", "yin_yang": "阳"},  # 0 Jia
    {"name": "乙", "element": "木", "yin_yang": "阴"},  # 1 Yi
    {"name": "丙", "element": "火", "yin_yang": "阳"},  # 2 Bing
    {"name": "丁", "element": "火", "yin_yang": "阴"},  # 3 Ding
    {"name": "戊", "element": "土", "yin_yang": "阳"},  # 4 Wu
    {"name": "己", "element": "土", "yin_yang": "阴"},  # 5 Ji
    {"name": "庚", "element": "金", "yin_yang": "阳"},  # 6 Geng
    {"name": "辛", "element": "金", "yin_yang": "阴"},  # 7 Xin
    {"name": "壬", "element": "水", "yin_yang": "阳"},  # 8 Ren
    {"name": "癸", "element": "水", "yin_yang": "阴"},  # 9 Gui
]

# Earthly branches with their elements and yin/yang properties
EARTHLY_BRANCHES = [
    {"name": "子", "element": "水", "yin_yang": "阳"},  # 0 Zi (Rat)
    {"name": "丑", "element": "土", "yin_yang": "阴"},  # 1 Chou (Ox)
    {"name": "寅", "element": "木", "yin_yang": "阳"},  # 2 Yin (Tiger)
    {"name": "卯", "element": "木", "yin_yang": "阴"},  # 3 Mao (Rabbit)
    {"name": "辰", "element": "土", "yin_yang": "阳"},  # 4 Chen (Dragon)
    {"name": "巳", "element": "火", "yin_yang": "阴"},  # 5 Si (Snake)
    {"name": "午", "element": "火", "yin_yang": "阳"},  # 6 Wu (Horse)
    {"name": "未", "element": "土", "yin_yang": "阴"},  # 7 Wei (Goat)
    {"name": "申", "element": "金", "yin_yang": "阳"},  # 8 Shen (Monkey)
    {"name": "酉", "element": "金", "yin_yang": "阴"},  # 9 You (Rooster)
    {"name": "戌", "element": "土", "yin_yang": "阳"},  # 10 Xu (Dog)
    {"name": "亥", "element": "水", "yin_yang": "阴"},  # 11 Hai (Pig)
]


def get_year_pillar(dt: datetime) -> (int, int):
    """
    Calculate the year pillar for a given datetime.  In classical BaZi the
    year begins with the solar term 立春 (Start of Spring) around 4 February,
    but many simplified implementations treat the lunar new year as the
    boundary.  Here we adopt the lunar new year method used in the Bazica
    project: if the date falls before the lunar new year, the previous
    calendar year is used to determine the heavenly stem and earthly branch.

    The calculation is based on the fact that 1984 was the year of 甲子
    (Jia‑Zi).  Therefore the indices for the stem and branch can be
    determined by counting the number of years offset from 1984.  The
    formulas correspond to those found in get_pillar_year.go【933841672981568†L21-L39】.
    """
    # Load lunar new year table once; this JSON file comes from the Bazica
    # project (data/lunar-new-year.json) and maps a year to the Gregorian date
    # (yyyy-mm-dd) of lunar new year.  It contains entries from 1900 through
    # 2100.  If the file is not found, default to February 4th.
    try:
        with open(os.path.join(app.root_path, 'data', 'lunar_new_year.json'), encoding='utf-8') as f:
            lunar_new_year = json.load(f)
    except FileNotFoundError:
        lunar_new_year = {}

    year = dt.year
    # Determine if the date is before the lunar new year
    lny_str = lunar_new_year.get(str(year))
    if lny_str:
        lny = datetime.strptime(lny_str, "%Y-%m-%d")
        if dt < lny:
            year -= 1
    else:
        # Fallback to 4 February as approximate boundary
        if dt.month < 2 or (dt.month == 2 and dt.day < 4):
            year -= 1

    # 1984 was Jia‑Zi (stem index 0, branch index 0)
    offset = year - 1984
    stem_index = (offset % 10) % 10
    branch_index = (offset % 12) % 12
    return stem_index, branch_index


def get_day_pillar(dt: datetime) -> (int, int):
    """
    Calculate the day pillar using the algorithm described in Bazica's
    get_pillar_day.go【436278212403553†L17-L34】.  The calculation counts the
    number of days that have elapsed since 1900‑01‑01 (which is known to be
    庚子 day in the sexagenary cycle) and then applies a modular offset to
    derive the day’s heavenly stem and earthly branch.
    """
    # Reference date 1900‑01‑01 corresponds to 庚子 day.  According to the
    # Bazica code, the stem index of that day is 6 (庚) and the branch index
    # is 0 (子).  We compute the number of days difference from this date
    # (including leap years) and adjust accordingly.
    ref_date = date(1900, 1, 1)
    delta_days = (dt.date() - ref_date).days
    # Stem: (6 + delta_days) mod 10
    stem_index = (6 + delta_days) % 10
    # Branch: (0 + delta_days) mod 12
    branch_index = (0 + delta_days) % 12
    return stem_index, branch_index


def get_month_pillar(year_stem: int, year_branch: int, dt: datetime) -> (int, int):
    """
    Determine the month pillar.  Traditionally the month branch is fixed
    relative to solar terms rather than lunar months.  Instead of
    astronomical calculations we use approximate boundaries around the
    principal terms (中气) when each BaZi month begins.  The boundaries are
    derived from the standard 24 solar terms and roughly correspond to the
    following Gregorian dates: 立春 (Feb 4), 惊蛰 (Mar 6), 清明 (Apr 5), 立夏 (May 5),
    芒种 (Jun 6), 小暑 (Jul 7), 立秋 (Aug 8), 白露 (Sep 8), 寒露 (Oct 8), 立冬 (Nov 7),
    大雪 (Dec 7), 小寒 (Jan 6).  If a date falls before the first boundary
    (roughly 4 February) the month branch is treated as the last branch of
    the previous year (丑).  After identifying the branch index, the month
    stem is calculated using the Five Tigers rule【283289781708604†L23-L29】: for
    each year stem a predetermined starting stem is assigned to the first
    month (寅), and subsequent months increment the stem index.
    """
    # Define approximate start dates for the 12 solar months in the current
    # Gregorian year.  Each entry is a tuple (month, day) representing the
    # beginning of the month branch.  These dates come from commonly used
    # approximations of the 24 solar terms.
    boundaries = [
        (2, 4),  # 立春 (Start of Spring) – beginning of 寅 month
        (3, 6),  # 惊蛰 – 卯
        (4, 5),  # 清明 – 辰
        (5, 5),  # 立夏 – 巳
        (6, 6),  # 芒种 – 午
        (7, 7),  # 小暑 – 未
        (8, 8),  # 立秋 – 申
        (9, 8),  # 白露 – 酉
        (10, 8), # 寒露 – 戌
        (11, 7), # 立冬 – 亥
        (12, 7), # 大雪 – 子
        (1, 6)   # 小寒 – 丑 (of next year)
    ]

    # Determine month branch by comparing against boundaries.  We handle the
    # special case where the date is before Feb 4 by considering it as last
    # year's 丑 month (branch index 1).  Otherwise, we loop through the
    # boundaries until we find the first boundary that is after the date.
    # The branch index corresponds to the index in EARTHLY_BRANCHES list.
    # The sequence of month branches always starts from 寅 (index 2) for the
    # first entry in boundaries and increases by 1 each month.
    month_branch_index = None
    month = dt.month
    day = dt.day
    # Build list of boundary datetimes for comparison
    current_year = dt.year
    boundary_dates = []
    for i, (m, d) in enumerate(boundaries):
        # For January boundary (index 11) we treat it as in next year
        year = current_year if i < 11 else current_year + 1
        boundary_dates.append(datetime(year, m, d))

    # If date is before first boundary, branch is last (丑)
    if dt < boundary_dates[0]:
        month_branch_index = 1  # 丑
    else:
        for i in range(len(boundary_dates) - 1):
            if boundary_dates[i] <= dt < boundary_dates[i + 1]:
                # The first boundary corresponds to 寅 (index 2)
                month_branch_index = (2 + i) % 12
                break
        else:
            # If date beyond last boundary (January of next year), it's 丑
            month_branch_index = 1

    # Five Tigers rule: starting stem for 寅 month depends on year stem
    five_tigers_start = {
        0: 2,  # Jia (甲) or Ji (己) start with Bing (丙)
        5: 2,
        1: 4,  # Yi (乙) or Geng (庚) start with Wu (戊)
        6: 4,
        2: 6,  # Bing (丙) or Xin (辛) start with Geng (庚)
        7: 6,
        3: 8,  # Ding (丁) or Ren (壬) start with Ren (壬)
        8: 8,
        4: 0,  # Wu (戊) or Gui (癸) start with Jia (甲)
        9: 0,
    }
    start_stem = five_tigers_start.get(year_stem, 2)
    # Compute month index relative to 寅 (0 for 寅, 1 for 卯, etc.)
    # Note that month_branch_index could be < 2 if wrap around; adjust by +12
    relative_idx = (month_branch_index - 2) % 12
    stem_index = (start_stem + relative_idx) % 10
    return stem_index, month_branch_index


def get_hour_pillar(day_stem: int, dt: datetime) -> (int, int):
    """
    Calculate the hour pillar based on the time of day.  The day is divided
    into 12 two‑hour segments, each associated with one earthly branch.  The
    branch index is determined by floor(hour / 2).  The stem index is
    calculated using the Five Rats rule【498096116057238†L18-L37】, which adds
    the branch index to twice the day stem and takes the result modulo 10.
    """
    # Determine branch: 23:00–00:59 is 子 (0), 01:00–02:59 is 丑 (1), etc.
    # We treat hours 23–24 as 0 for convenience.
    hour = dt.hour
    branch_index = ((hour + 1) // 2) % 12
    # Five Rats rule: stem index = (day_stem * 2 + branch_index) mod 10
    stem_index = (day_stem * 2 + branch_index) % 10
    return stem_index, branch_index


def calculate_bazi(dt: datetime) -> dict:
    """
    Given a datetime, compute the four pillars (year, month, day, hour).
    Returns a dictionary containing each pillar's stem and branch indices as
    well as human‑readable names and the element/ yin‑yang counts for
    summary charts.
    """
    # Year pillar
    y_stem, y_branch = get_year_pillar(dt)
    # Day pillar
    d_stem, d_branch = get_day_pillar(dt)
    # Month pillar (uses year stem/branch for Five Tigers rule)
    m_stem, m_branch = get_month_pillar(y_stem, y_branch, dt)
    # Hour pillar (uses day stem for Five Rats rule)
    h_stem, h_branch = get_hour_pillar(d_stem, dt)

    # Compose results
    pillars = [
        {
            "pillar": "年柱",
            "stem_index": y_stem,
            "branch_index": y_branch,
            "stem": HEAVENLY_STEMS[y_stem]["name"],
            "branch": EARTHLY_BRANCHES[y_branch]["name"],
        },
        {
            "pillar": "月柱",
            "stem_index": m_stem,
            "branch_index": m_branch,
            "stem": HEAVENLY_STEMS[m_stem]["name"],
            "branch": EARTHLY_BRANCHES[m_branch]["name"],
        },
        {
            "pillar": "日柱",
            "stem_index": d_stem,
            "branch_index": d_branch,
            "stem": HEAVENLY_STEMS[d_stem]["name"],
            "branch": EARTHLY_BRANCHES[d_branch]["name"],
        },
        {
            "pillar": "时柱",
            "stem_index": h_stem,
            "branch_index": h_branch,
            "stem": HEAVENLY_STEMS[h_stem]["name"],
            "branch": EARTHLY_BRANCHES[h_branch]["name"],
        },
    ]

    # Count elements and yin/yang
    elements_count = {"木": 0, "火": 0, "土": 0, "金": 0, "水": 0}
    yin_count = 0
    yang_count = 0
    for p in pillars:
        stem = HEAVENLY_STEMS[p["stem_index"]]
        branch = EARTHLY_BRANCHES[p["branch_index"]]
        elements_count[stem["element"]] += 1
        elements_count[branch["element"]] += 1
        yin_count += 1 if stem["yin_yang"] == "阴" else 0
        yin_count += 1 if branch["yin_yang"] == "阴" else 0
        yang_count += 1 if stem["yin_yang"] == "阳" else 0
        yang_count += 1 if branch["yin_yang"] == "阳" else 0

    result = {
        "pillars": pillars,
        "elements_count": elements_count,
        "yin": yin_count,
        "yang": yang_count,
    }
    return result


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/calculate', methods=['POST'])
def calculate():
    data = request.json
    # Parse input fields
    name = data.get('name', '')
    relationship = data.get('relationship', '本人')
    date_str = data.get('date')  # format: YYYY-MM-DD
    time_str = data.get('time')  # format: HH:MM
    location = data.get('location', {})  # {province, city, district}

    try:
        dt = datetime.strptime(date_str + ' ' + time_str, '%Y-%m-%d %H:%M')
    except Exception:
        return jsonify({"error": "Invalid date/time format"}), 400

    bazi = calculate_bazi(dt)
    bazi['name'] = name
    bazi['relationship'] = relationship
    bazi['location'] = location
    bazi['datetime'] = dt.strftime('%Y-%m-%d %H:%M')
    return jsonify(bazi)


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)