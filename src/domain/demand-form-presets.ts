import type {DemandFormQuestion} from '../types';

/** Optional starter questions: preferences, NOT official university academic rules. */
export function demandCourseSurveyStarter():DemandFormQuestion[] {
  return [
    {id:'pref_session',kind:'single_choice',title:'چه بازه‌ای برای کلاس‌ها مناسب‌تر است؟',
      description:'فقط یک ترجیح برای برنامه‌ریزی گروه‌ها، نه تضمین ساعت نهایی.',
      required:false,options:['صبح','میانه روز','عصر','تفاوتی ندارد']},
    {id:'pref_days',kind:'multiple_choice',title:'در کدام روزها حضور در دانشگاه برایتان مناسب‌تر است؟',
      required:false,options:['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه']},
    {id:'pref_attendance',kind:'single_choice',title:'چند روز حضور در هفته را ترجیح می‌دهید؟',
      required:false,options:['۲ روز','۳ روز','۴ روز','۵ روز','تفاوتی ندارد']},
    {id:'pref_urgent',kind:'single_choice',title:'آیا ارائهٔ یک درس در نیمسال هدف برای شما فوریت ویژه دارد؟',
      required:false,options:['بله','خیر']},
    {id:'pref_urgent_reason',kind:'long_text',title:'دلیل فوریت را توضیح دهید (اختیاری)',
      description:'از درج اطلاعات حساس یا غیرضروری خودداری کنید.',
      required:false,visibleWhen:{questionId:'pref_urgent',equals:'بله'}},
  ];
}
