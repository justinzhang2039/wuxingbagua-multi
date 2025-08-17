// Front‑end script for the BaZi calculator
document.addEventListener('DOMContentLoaded', () => {
  // -------------------------------
  // 动态加载完整的省市区数据
  //
  // 为了覆盖全国 34 个省级行政单位、333 个地级行政单位和约 2,850 个县级行政单位，
  // 本版不再在脚本中硬编码少量示例数据，而是从开源项目 china‑division 获取三级联动数据。
  // china‑division 的 pca.json 文件提供了省 → 市 → 区的完整映射，并支持跨域访问。
  // 由于 fetch() 支持跨域并返回 JSON，我们在页面加载时获取该数据，并在加载完成后填充下拉框。
  // 如果网络请求失败，则会退回到内置的小型数据集以保证基本功能。

  const PCA_URL = 'https://unpkg.com/china-division@2.7.0/dist/pca.json';
  let pcaData = null;
  let provincesList = [];

  // 用于存储所有人物的排盘结果。索引 0 对应页面默认的首个人物，其余索引为新添加的人物。
  const allResults = [];

  const provinceSelect = document.getElementById('province');
  const citySelect = document.getElementById('city');
  const districtSelect = document.getElementById('district');

  // 加载省市区数据
  async function loadLocationData() {
    try {
      const res = await fetch(PCA_URL);
      if (!res.ok) throw new Error('Network response was not ok');
      pcaData = await res.json();
      provincesList = Object.keys(pcaData);
      populateProvinces();
    } catch (err) {
      console.error('无法从远程加载完整行政区划数据，使用备份数据。', err);
      // 备份数据包含部分省份，保证应用仍可工作但信息不全
      pcaData = {
        '北京市': { '北京市': ['东城区','西城区','朝阳区','丰台区','石景山区','海淀区','门头沟区','房山区','通州区','顺义区','昌平区','大兴区','怀柔区','平谷区','密云区','延庆区'] },
        '上海市': { '上海市': ['黄浦区','徐汇区','长宁区','静安区','普陀区','虹口区','杨浦区','闵行区','宝山区','嘉定区','浦东新区','金山区','松江区','青浦区','奉贤区','崇明区'] },
        '广东省': { '广州市': ['荔湾区','越秀区','海珠区','天河区','白云区','黄埔区','番禺区','花都区','南沙区','从化区','增城区'], '深圳市': ['罗湖区','福田区','南山区','宝安区','龙岗区','龙华区','坪山区','光明区'] },
        '江苏省': { '南京市': ['玄武区','秦淮区','建邺区','鼓楼区','浦口区','栖霞区','雨花台区','江宁区','六合区','溧水区','高淳区'], '苏州市': ['姑苏区','吴中区','相城区','姑苏区','吴江区','常熟市','张家港市','昆山市','太仓市'] },
        '浙江省': { '杭州市': ['上城区','拱墅区','西湖区','滨江区','萧山区','余杭区','临平区','钱塘区','富阳区','临安区','桐庐县','淳安县','建德市'], '宁波市': ['海曙区','江北区','北仑区','镇海区','鄞州区','奉化区','象山县','宁海县','余姚市','慈溪市'] }
      };
      provincesList = Object.keys(pcaData);
      populateProvinces();
    }
  }

  // 根据 pcaData 填充省份下拉框
  function populateProvinces() {
    provinceSelect.innerHTML = '<option value="">省/直辖市</option>';
    provincesList.forEach(prov => {
      const opt = document.createElement('option');
      opt.value = prov;
      opt.textContent = prov;
      provinceSelect.appendChild(opt);
    });
  }

  // 根据选择的省份填充城市下拉框
  function populateCities(provinceName) {
    citySelect.innerHTML = '<option value="">市</option>';
    districtSelect.innerHTML = '<option value="">区/县</option>';
    if (!provinceName || !pcaData) return;
    const cityObj = pcaData[provinceName] || {};
    Object.keys(cityObj).forEach(cityName => {
      const opt = document.createElement('option');
      opt.value = cityName;
      opt.textContent = cityName;
      citySelect.appendChild(opt);
    });
  }

  // 根据选择的城市填充区县下拉框
  function populateDistricts(provinceName, cityName) {
    districtSelect.innerHTML = '<option value="">区/县</option>';
    if (!provinceName || !cityName || !pcaData) return;
    const districtsArr = pcaData[provinceName]?.[cityName] || [];
    districtsArr.forEach(dist => {
      const opt = document.createElement('option');
      opt.value = dist;
      opt.textContent = dist;
      districtSelect.appendChild(opt);
    });
  }

  // 监听下拉框变化
  provinceSelect.addEventListener('change', () => {
    const prov = provinceSelect.value;
    populateCities(prov);
  });
  citySelect.addEventListener('change', () => {
    const prov = provinceSelect.value;
    const city = citySelect.value;
    populateDistricts(prov, city);
  });

  // 在页面加载完成时开始加载行政区划数据
  loadLocationData();

  /* -------------------------------------------------
   * BaZi calculation functions (client side)
   *
   * These functions implement a simplified version of the
   * sexagenary cycle conversion, closely following the
   * algorithms described in the open‑source Bazica project.
   * They have been ported from Python into JavaScript
   * for direct execution in the browser.
   */

  // Heavenly stems with elements and yin/yang properties
  const HEAVENLY_STEMS = [
    { name: '甲', element: '木', yinYang: '阳' },
    { name: '乙', element: '木', yinYang: '阴' },
    { name: '丙', element: '火', yinYang: '阳' },
    { name: '丁', element: '火', yinYang: '阴' },
    { name: '戊', element: '土', yinYang: '阳' },
    { name: '己', element: '土', yinYang: '阴' },
    { name: '庚', element: '金', yinYang: '阳' },
    { name: '辛', element: '金', yinYang: '阴' },
    { name: '壬', element: '水', yinYang: '阳' },
    { name: '癸', element: '水', yinYang: '阴' }
  ];

  // Earthly branches with elements and yin/yang properties
  const EARTHLY_BRANCHES = [
    { name: '子', element: '水', yinYang: '阳' },
    { name: '丑', element: '土', yinYang: '阴' },
    { name: '寅', element: '木', yinYang: '阳' },
    { name: '卯', element: '木', yinYang: '阴' },
    { name: '辰', element: '土', yinYang: '阳' },
    { name: '巳', element: '火', yinYang: '阴' },
    { name: '午', element: '火', yinYang: '阳' },
    { name: '未', element: '土', yinYang: '阴' },
    { name: '申', element: '金', yinYang: '阳' },
    { name: '酉', element: '金', yinYang: '阴' },
    { name: '戌', element: '土', yinYang: '阳' },
    { name: '亥', element: '水', yinYang: '阴' }
  ];

  // Approximate boundaries for each BaZi month (solar term based)
  const MONTH_BOUNDARIES = [
    { month: 2, day: 4 },  // 立春 – 寅
    { month: 3, day: 6 },  // 惊蛰 – 卯
    { month: 4, day: 5 },  // 清明 – 辰
    { month: 5, day: 5 },  // 立夏 – 巳
    { month: 6, day: 6 },  // 芒种 – 午
    { month: 7, day: 7 },  // 小暑 – 未
    { month: 8, day: 8 },  // 立秋 – 申
    { month: 9, day: 8 },  // 白露 – 酉
    { month: 10, day: 8 }, // 寒露 – 戌
    { month: 11, day: 7 }, // 立冬 – 亥
    { month: 12, day: 7 }, // 大雪 – 子
    { month: 1, day: 6 }   // 小寒 – 丑 (next year)
  ];

  /**
   * Compute year pillar.
   *
   * This function approximates the year boundary using the solar
   * term 立春 (around 4 February).  If the date falls before that
   * boundary, the previous Gregorian year is used.  The stem and
   * branch indices are then calculated relative to 1984 (甲子年) as
   * described in Bazica【933841672981568†L21-L39】.
   */
  function getYearPillar(dt) {
    let year = dt.getFullYear();
    // If before Feb 4, treat as previous year
    if (dt.getMonth() + 1 < 2 || (dt.getMonth() + 1 === 2 && dt.getDate() < 4)) {
      year -= 1;
    }
    const offset = year - 1984;
    const stemIndex = ((offset % 10) + 10) % 10;
    const branchIndex = ((offset % 12) + 12) % 12;
    return { stemIndex, branchIndex };
  }

  /**
   * Compute day pillar.
   *
   * The algorithm counts the number of days since 1900‑01‑01 and
   * applies modular offsets to derive the stem and branch, following
   * Bazica's implementation【436278212403553†L17-L34】.
   */
  function getDayPillar(dt) {
    const ref = new Date(1900, 0, 1); // 1900‑01‑01
    const diff = Math.floor((dt - ref) / (24 * 60 * 60 * 1000));
    const stemIndex = (6 + diff) % 10;
    const branchIndex = (0 + diff) % 12;
    return { stemIndex, branchIndex };
  }

  /**
   * Compute month pillar using approximate solar term boundaries.
   *
   * The month branch is determined by comparing the date to the
   * predefined boundaries (MONTH_BOUNDARIES).  The first boundary
   * corresponds to 寅 (index 2), and subsequent months increment
   * the branch index.  The month stem is calculated via the
   * Five Tigers rule【283289781708604†L23-L29】, which assigns a
   * starting stem to the first month based on the year stem.
   */
  function getMonthPillar(yearStem, dt) {
    const year = dt.getFullYear();
    // Build actual Date objects for boundaries in the current year
    const boundaryDates = MONTH_BOUNDARIES.map((b, idx) => {
      const y = idx < 11 ? year : year + 1; // last boundary belongs to next year
      return new Date(y, b.month - 1, b.day);
    });
    let branchIndex;
    if (dt < boundaryDates[0]) {
      branchIndex = 1; // 丑
    } else {
      for (let i = 0; i < boundaryDates.length - 1; i++) {
        if (dt >= boundaryDates[i] && dt < boundaryDates[i + 1]) {
          branchIndex = (2 + i) % 12;
          break;
        }
      }
      if (branchIndex === undefined) {
        branchIndex = 1;
      }
    }
    // Five Tigers rule – starting stems for 寅 month depending on year stem
    const fiveTigersStart = {
      0: 2, 5: 2, // 甲或己 → 丙
      1: 4, 6: 4, // 乙或庚 → 戊
      2: 6, 7: 6, // 丙或辛 → 庚
      3: 8, 8: 8, // 丁或壬 → 壬
      4: 0, 9: 0, // 戊或癸 → 甲
    };
    const startStem = fiveTigersStart[yearStem] ?? 2;
    const relativeIdx = (branchIndex - 2 + 12) % 12;
    const stemIndex = (startStem + relativeIdx) % 10;
    return { stemIndex, branchIndex };
  }

  /**
   * Compute hour pillar.
   *
   * The day is divided into 12 two‑hour segments with branches
   * starting at 子 (23:00–00:59).  The stem is obtained via the
   * Five Rats rule【498096116057238†L18-L37】.
   */
  function getHourPillar(dayStem, dt) {
    const hour = dt.getHours();
    const branchIndex = Math.floor((hour + 1) / 2) % 12;
    const stemIndex = (dayStem * 2 + branchIndex) % 10;
    return { stemIndex, branchIndex };
  }

  /**
   * Calculate the full BaZi chart for a given Date object.
   *
   * Returns an object containing the four pillars, counts of five
   * elements and counts of yin/yang for basic analysis.
   */
  function calculateBazi(dt) {
    const year = getYearPillar(dt);
    const day = getDayPillar(dt);
    const month = getMonthPillar(year.stemIndex, dt);
    const hour = getHourPillar(day.stemIndex, dt);
    const pillars = [
      { pillar: '年柱', stemIndex: year.stemIndex, branchIndex: year.branchIndex, stem: HEAVENLY_STEMS[year.stemIndex].name, branch: EARTHLY_BRANCHES[year.branchIndex].name },
      { pillar: '月柱', stemIndex: month.stemIndex, branchIndex: month.branchIndex, stem: HEAVENLY_STEMS[month.stemIndex].name, branch: EARTHLY_BRANCHES[month.branchIndex].name },
      { pillar: '日柱', stemIndex: day.stemIndex, branchIndex: day.branchIndex, stem: HEAVENLY_STEMS[day.stemIndex].name, branch: EARTHLY_BRANCHES[day.branchIndex].name },
      { pillar: '时柱', stemIndex: hour.stemIndex, branchIndex: hour.branchIndex, stem: HEAVENLY_STEMS[hour.stemIndex].name, branch: EARTHLY_BRANCHES[hour.branchIndex].name },
    ];
    // Count elements and yin/yang
    const elementsCount = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 };
    let yin = 0;
    let yang = 0;
    pillars.forEach(p => {
      const s = HEAVENLY_STEMS[p.stemIndex];
      const b = EARTHLY_BRANCHES[p.branchIndex];
      elementsCount[s.element]++;
      elementsCount[b.element]++;
      if (s.yinYang === '阴') yin++; else yang++;
      if (b.yinYang === '阴') yin++; else yang++;
    });
    return {
      pillars,
      elements_count: elementsCount,
      yin,
      yang
    };
  }

  // 旧的省市区填充逻辑已移除。新的逻辑在 loadLocationData() 中动态加载和填充。

  // Handle calculation – compute BaZi directly in the browser
  document.getElementById('calculateBtn').addEventListener('click', () => {
    const name = document.getElementById('name').value.trim();
    const birthDate = document.getElementById('birthDate').value;
    const birthTime = document.getElementById('birthTime').value;
    const relationship = document.getElementById('relationship').value;
    const provinceVal = provinceSelect.value;
    const cityVal = citySelect.value;
    const districtVal = districtSelect.value;
    if (!birthDate || !birthTime) {
      alert('请填写完整的日期和时间');
      return;
    }
    const location = {};
    if (provinceVal) {
      location.province = provinceVal;
    }
    if (cityVal) {
      location.city = cityVal;
    }
    if (districtVal) {
      location.district = districtVal;
    }
    const dt = new Date(`${birthDate}T${birthTime}:00`);
    const result = calculateBazi(dt);
    result.name = name;
    result.relationship = relationship;
    result.location = location;
    result.datetime = `${birthDate} ${birthTime}`;
    showResult(result);
  });

  let chart; // Chart.js instance

  function showResult(data) {
    // Display pillars
    const pillarsContainer = document.getElementById('pillars');
    pillarsContainer.innerHTML = '';
    data.pillars.forEach(item => {
      const div = document.createElement('div');
      div.className = 'text-center border p-2 rounded bg-gray-50';
      div.innerHTML = `<div class="font-semibold">${item.pillar}</div><div class="text-xl">${item.stem}${item.branch}</div>`;
      pillarsContainer.appendChild(div);
    });
    // Prepare chart data
    const labels = Object.keys(data.elements_count);
    const counts = labels.map(k => data.elements_count[k]);
    const colors = {
      '木': 'rgba(34,197,94,0.7)',   // green
      '火': 'rgba(239,68,68,0.7)',   // red
      '土': 'rgba(245,158,11,0.7)', // yellow/orange
      '金': 'rgba(107,114,128,0.7)', // gray
      '水': 'rgba(56,189,248,0.7)',  // blue
    };
    const backgroundColors = labels.map(l => colors[l]);

    const ctx = document.getElementById('elementChart').getContext('2d');
    if (chart) {
      chart.destroy();
    }
    chart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [{
          label: '五行数量',
          data: counts,
          backgroundColor: 'rgba(59,130,246,0.2)',
          borderColor: 'rgba(59,130,246,1)',
          pointBackgroundColor: backgroundColors,
          pointBorderColor: '#fff',
        }],
      },
      options: {
        scales: {
          r: {
            beginAtZero: true,
            suggestedMax: Math.max(...counts) + 1,
          },
        },
        plugins: {
          legend: { display: false },
        },
      },
    });
    // Analysis text
    const analysisEl = document.getElementById('analysis');
    const yin = data.yin;
    const yang = data.yang;
    const yinYangMsg = yin > yang ? '阴性偏旺' : (yang > yin ? '阳性偏旺' : '阴阳平衡');
    // Determine strongest and weakest elements
    let maxElem = labels[0];
    let minElem = labels[0];
    labels.forEach((key) => {
      if (data.elements_count[key] > data.elements_count[maxElem]) maxElem = key;
      if (data.elements_count[key] < data.elements_count[minElem]) minElem = key;
    });
    analysisEl.innerHTML = `
      <p><strong>阴阳情况：</strong>${yinYangMsg}（阴：${yin}，阳：${yang}）</p>
      <p><strong>五行分析：</strong>最旺的是 <span class="font-semibold">${maxElem}</span>，最弱的是 <span class="font-semibold">${minElem}</span>。</p>
      <p>请注意，系统采用简化算法并使用近似节气分界，因此结果仅供参考，若需深入分析请咨询专业命理师。</p>
    `;

    // 将首个人物的排盘结果存入全局数组，用于多人物五行匹配计算
    allResults[0] = data;
    // Show result section
    document.getElementById('result').classList.remove('hidden');
  }

  /* =============================================================
   * 多人物排盘与五行匹配功能
   *
   * 以下函数允许用户动态添加多个人物的排盘输入区域，并在
   * 计算后将结果存入全局 allResults 数组。点击“五行匹配程度”
   * 按钮后，会遍历所有计算完成的排盘结果，根据五行数量的
   * 差异给出综合匹配评级。
   */

  // 为指定的省份下拉框填充数据
  function populateProvincesSelect(select) {
    select.innerHTML = '<option value="">省/直辖市</option>';
    provincesList.forEach(prov => {
      const opt = document.createElement('option');
      opt.value = prov;
      opt.textContent = prov;
      select.appendChild(opt);
    });
  }

  // 为卡片填充城市
  function populateCitiesSelect(provinceName, citySelect, districtSelect) {
    citySelect.innerHTML = '<option value="">市</option>';
    districtSelect.innerHTML = '<option value="">区/县</option>';
    if (!provinceName || !pcaData) return;
    const cityObj = pcaData[provinceName] || {};
    Object.keys(cityObj).forEach(cityName => {
      const opt = document.createElement('option');
      opt.value = cityName;
      opt.textContent = cityName;
      citySelect.appendChild(opt);
    });
  }

  // 为卡片填充区县
  function populateDistrictsSelect(provinceName, cityName, districtSelect) {
    districtSelect.innerHTML = '<option value="">区/县</option>';
    if (!provinceName || !cityName || !pcaData) return;
    const districtsArr = pcaData[provinceName]?.[cityName] || [];
    districtsArr.forEach(dist => {
      const opt = document.createElement('option');
      opt.value = dist;
      opt.textContent = dist;
      districtSelect.appendChild(opt);
    });
  }

  // 显示特定人物的排盘结果（卡片模式）
  function showResultForCard(cardEl, data, idx) {
    const pillarsContainer = cardEl.querySelector('.pillars');
    pillarsContainer.innerHTML = '';
    data.pillars.forEach(item => {
      const div = document.createElement('div');
      div.className = 'text-center border p-2 rounded bg-gray-50';
      div.innerHTML = `<div class="font-semibold">${item.pillar}</div><div class="text-xl">${item.stem}${item.branch}</div>`;
      pillarsContainer.appendChild(div);
    });
    const labels = Object.keys(data.elements_count);
    const counts = labels.map(k => data.elements_count[k]);
    const colors = {
      '木': 'rgba(34,197,94,0.7)',
      '火': 'rgba(239,68,68,0.7)',
      '土': 'rgba(245,158,11,0.7)',
      '金': 'rgba(107,114,128,0.7)',
      '水': 'rgba(56,189,248,0.7)',
    };
    const backgroundColors = labels.map(l => colors[l]);
    const ctx = cardEl.querySelector('.element-chart').getContext('2d');
    // 如果之前存在图表则销毁
    if (cardEl._chart) {
      cardEl._chart.destroy();
    }
    cardEl._chart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [{
          label: '五行数量',
          data: counts,
          backgroundColor: 'rgba(59,130,246,0.2)',
          borderColor: 'rgba(59,130,246,1)',
          pointBackgroundColor: backgroundColors,
          pointBorderColor: '#fff',
        }],
      },
      options: {
        scales: {
          r: {
            beginAtZero: true,
            suggestedMax: Math.max(...counts) + 1,
          },
        },
        plugins: {
          legend: { display: false },
        },
      },
    });
    // 分析文本
    const analysisEl = cardEl.querySelector('.analysis');
    const yin = data.yin;
    const yang = data.yang;
    const yinYangMsg = yin > yang ? '阴性偏旺' : (yang > yin ? '阳性偏旺' : '阴阳平衡');
    let maxElem = labels[0];
    let minElem = labels[0];
    labels.forEach(key => {
      if (data.elements_count[key] > data.elements_count[maxElem]) maxElem = key;
      if (data.elements_count[key] < data.elements_count[minElem]) minElem = key;
    });
    analysisEl.innerHTML = `
      <p><strong>阴阳情况：</strong>${yinYangMsg}（阴：${yin}，阳：${yang}）</p>
      <p><strong>五行分析：</strong>最旺的是 <span class="font-semibold">${maxElem}</span>，最弱的是 <span class="font-semibold">${minElem}</span>。</p>
      <p>请注意，系统采用简化算法并使用近似节气分界，因此结果仅供参考，若需深入分析请咨询专业命理师。</p>
    `;
    cardEl.querySelector('.result-section').classList.remove('hidden');
  }

  // 创建新的排盘卡片
  function addPersonCard() {
    // 索引等于当前结果数组长度（首个人物使用索引 0）
    const idx = allResults.length;
    const container = document.getElementById('additional-persons');
    const card = document.createElement('div');
    card.className = 'bg-white shadow-md rounded px-4 py-3';
    card.innerHTML = `
      <h3 class="text-lg font-semibold mb-2">人物 ${idx + 1}</h3>
      <div class="grid gap-4 person-form">
        <div>
          <label class="block text-sm font-medium text-gray-700">姓名</label>
          <input type="text" class="name-input mt-1 w-full border rounded px-3 py-2" placeholder="请输入姓名" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">出生日期</label>
          <input type="date" class="date-input mt-1 w-full border rounded px-3 py-2" min="1900-01-01" max="2100-12-31" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">出生时间</label>
          <input type="time" class="time-input mt-1 w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">出生地</label>
          <div class="flex space-x-2 mt-1">
            <select class="province-select border rounded px-3 py-2 flex-1">
              <option value="">省/直辖市</option>
            </select>
            <select class="city-select border rounded px-3 py-2 flex-1">
              <option value="">市</option>
            </select>
            <select class="district-select border rounded px-3 py-2 flex-1">
              <option value="">区/县</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">关系</label>
          <select class="relationship-select mt-1 w-full border rounded px-3 py-2">
            <option value="本人">本人</option>
            <option value="伴侣">伴侣</option>
            <option value="家人">家人</option>
            <option value="朋友">朋友</option>
            <option value="其他">其他</option>
          </select>
        </div>
        <button class="calc-btn bg-blue-500 text-white py-2 px-4 rounded">开始排盘</button>
      </div>
      <div class="result-section hidden mt-4">
        <div class="pillars grid grid-cols-4 gap-4 mb-4"></div>
        <canvas class="element-chart"></canvas>
        <div class="analysis text-sm leading-relaxed mt-2"></div>
      </div>
    `;
    container.appendChild(card);
    // 填充省份
    const provinceSel = card.querySelector('.province-select');
    const citySel = card.querySelector('.city-select');
    const districtSel = card.querySelector('.district-select');
    populateProvincesSelect(provinceSel);
    provinceSel.addEventListener('change', () => {
      populateCitiesSelect(provinceSel.value, citySel, districtSel);
    });
    citySel.addEventListener('change', () => {
      populateDistrictsSelect(provinceSel.value, citySel.value, districtSel);
    });
    // 计算按钮事件
    card.querySelector('.calc-btn').addEventListener('click', () => {
      const name = card.querySelector('.name-input').value.trim();
      const birthDate = card.querySelector('.date-input').value;
      const birthTime = card.querySelector('.time-input').value;
      const relationship = card.querySelector('.relationship-select').value;
      if (!birthDate || !birthTime) {
        alert('请填写完整的日期和时间');
        return;
      }
      const location = {};
      if (provinceSel.value) location.province = provinceSel.value;
      if (citySel.value) location.city = citySel.value;
      if (districtSel.value) location.district = districtSel.value;
      const dt = new Date(`${birthDate}T${birthTime}:00`);
      const result = calculateBazi(dt);
      result.name = name;
      result.relationship = relationship;
      result.location = location;
      result.datetime = `${birthDate} ${birthTime}`;
      showResultForCard(card, result, idx);
      allResults[idx] = result;
    });
  }

  // 计算所有人物的五行匹配程度
  function computeCompatibility() {
    const validResults = allResults.filter(r => r && r.elements_count);
    if (validResults.length < 2) {
      return '请先为至少两个人完成排盘，才能进行五行匹配。';
    }
    // 统计每个五行在所有人物中的最小与最大数量差异
    const elements = ['木','火','土','金','水'];
    let diffSum = 0;
    elements.forEach(elem => {
      let minCount = validResults[0].elements_count[elem];
      let maxCount = validResults[0].elements_count[elem];
      validResults.forEach(res => {
        const val = res.elements_count[elem];
        if (val < minCount) minCount = val;
        if (val > maxCount) maxCount = val;
      });
      diffSum += (maxCount - minCount);
    });
    let rating;
    if (diffSum <= 3) rating = '高';
    else if (diffSum <= 6) rating = '中等';
    else rating = '较低';
    return `综合 ${validResults.length} 人的五行匹配程度：${rating}。元素差异总和为 ${diffSum}；差异越小表示五行越互补。`;
  }

  // 绑定按钮事件
  const addBtn = document.getElementById('addPersonBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      addPersonCard();
    });
  }
  const compBtn = document.getElementById('compatibilityBtn');
  if (compBtn) {
    compBtn.addEventListener('click', () => {
      const resMsg = computeCompatibility();
      document.getElementById('compatibility-result').textContent = resMsg;
    });
  }
});