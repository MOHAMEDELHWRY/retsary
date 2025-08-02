export const descriptionOptions: string[] = [
    // شركات الأسمنت المصرية الرئيسية
    'اسمنت العريش',
    'اسمنت طرة',
    'اسمنت حلوان',
    'اسمنت القومية',
    'اسمنت بني سويف',
    'اسمنت المقطم',
    'اسمنت ميناء',
    'اسمنت بورتلاند طرة',
    'اسمنت العامرية',
    'اسمنت السويس',
    'اسمنت أسيوط',
    'اسمنت قنا',
    'اسمنت الوادي',
    'اسمنت المنيا',
    'اسمنت الصعيد',
    'اسمنت سيناء',
    'اسمنت الإسكندرية',
    'اسمنت دمياط',
    'اسمنت كفر الشيخ',
    'اسمنت البحيرة',
    'اسمنت الفيوم',
    'اسمنت الجيزة',
    'اسمنت بنها',
    'اسمنت طنطا',
    'اسمنت زفتى',
    'اسمنت سمالوط',
    'اسمنت العبور',
    'اسمنت ٦ أكتوبر',
    'اسمنت الشروق',
    'اسمنت مدينة نصر',
    // مصانع إضافية
    'اسمنت النصر للتعدين',
    'اسمنت سيدي كرير',
    'اسمنت وادي النطرون',
    'اسمنت راس غارب',
    'اسمنت القصير',
    'اسمنت مرسى علم',
    'اسمنت الطور',
    'اسمنت نويبع',
    'اسمنت دهب',
    'اسمنت شرم الشيخ'
];

// Helper functions for dynamic addition
export const addNewDescription = (newDescription: string): void => {
    if (newDescription.trim() && !descriptionOptions.includes(newDescription.trim())) {
        descriptionOptions.push(newDescription.trim());
        // Save to localStorage for persistence
        if (typeof window !== 'undefined') {
            const customDescriptions = JSON.parse(localStorage.getItem('customDescriptions') || '[]');
            customDescriptions.push(newDescription.trim());
            localStorage.setItem('customDescriptions', JSON.stringify(customDescriptions));
        }
    }
};

export const loadCustomDescriptions = (): void => {
    if (typeof window !== 'undefined') {
        const customDescriptions = JSON.parse(localStorage.getItem('customDescriptions') || '[]');
        customDescriptions.forEach((desc: string) => {
            if (!descriptionOptions.includes(desc)) {
                descriptionOptions.push(desc);
            }
        });
    }
};

export const categoryOptions: string[] = [
    'معبأ', 
    'سائب'
];

export const varietyOptions: string[] = [
    '22.5',
    '32.5',
    '42.5',
    '52.5'
];
