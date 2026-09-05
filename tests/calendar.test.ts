import { jalaliToGregorian } from '../src/utils/calendar';
import assert from 'assert';

function testConversion() {
  const cases = [
    // format: [JY, JM, JD, GY, GM, GD]
    [1403, 10, 24, 2025, 1, 13],
    [1399, 12, 30, 2021, 3, 20], // Leap year in Jalali
    [1400, 1, 1, 2021, 3, 21],
    [1404, 6, 31, 2025, 9, 22],
    [1357, 11, 22, 1979, 2, 11],
  ];

  let passed = 0;
  for (const c of cases) {
    const [jy, jm, jd, egy, egm, egd] = c;
    const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
    if (gy === egy && gm === egm && gd === egd) {
      passed++;
    } else {
      console.error(`Failed: Jalali ${jy}/${jm}/${jd} -> Expected ${egy}-${egm}-${egd}, Got ${gy}-${gm}-${gd}`);
    }
  }
  console.log(`Passed ${passed} / ${cases.length} tests`);
}

testConversion();