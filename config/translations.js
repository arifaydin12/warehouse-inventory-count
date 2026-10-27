// Enhanced Translations v3.0 - Complete i18n support
const TRANSLATIONS = {
    tr: {
        // App Info
        appTitle: "Depo Sayım Sistemi",
        appSubtitle: "Profesyonel Envanter Yönetimi",
        edition: "Professional Edition",
        version: "v3.0",
        
        // Auth & Login
        loginHeader: "Kullanıcı Girişi",
        loginInfo: "Kullanıcı seçerek sisteme giriş yapın",
        username: "Kullanıcı Adı",
        password: "Şifre",
        rememberMe: "Beni Hatırla",
        forgotPassword: "Şifremi Unuttum",
        loginButton: "Giriş Yap",
        logoutButton: "Çıkış Yap",
        exit: "Çıkış",
        
        // Dashboard
        dashboard: "Kontrol Paneli",
        welcome: "Hoş geldiniz",
        systemActive: "Sistem Aktif",
        statusActive: "Aktif",
        statusMaintenance: "Bakımda",
        capacity: "Kapasite Doluluk",
        
        // Warehouse
        warehouseSelection: "Depo Seçimi",
        warehouse: "Depo",
        warehouses: "Depolar",
        warehouseName: "Depo Adı",
        warehouseLocation: "Depo Konumu",
        warehouseCapacity: "Kapasite",
        addWarehouse: "Depo Ekle",
        editWarehouse: "Depo Düzenle",
        deleteWarehouse: "Depo Sil",
        
        // User Management
        users: "Kullanıcılar",
        addUser: "Kullanıcı Ekle",
        editUser: "Kullanıcı Düzenle",
        deleteUser: "Kullanıcı Sil",
        userName: "Kullanıcı Adı",
        userRole: "Rol",
        userPermission: "Yetki",
        userStatus: "Durum",
        active: "Aktif",
        inactive: "Pasif",
        admin: "Yönetici",
        manager: "Müdür",
        employee: "Çalışan",
        operator: "Operatör",
        
        // Product Management
        products: "Ürünler",
        product: "Ürün",
        productCode: "Ürün Kodu",
        productName: "Ürün Adı",
        lotNumber: "Lot Numarası",
        category: "Kategori",
        unit: "Birim",
        minStock: "Minimum Stok",
        addProduct: "Ürün Ekle",
        editProduct: "Ürün Düzenle",
        deleteProduct: "Ürün Sil",
        
        // Inventory/Count
        newCount: "Yeni Sayım Kaydı",
        countRecords: "Sayım Kayıtları",
        totalCounts: "Toplam Sayım",
        totalQuantity: "Toplam Miktar",
        uniqueProducts: "Farklı Ürün",
        today: "Bugün",
        audit: "Tüm kayıtlar",
        unitsCounted: "Sayılan birimler",
        productVariety: "Ürün çeşidi",
        dailyCount: "Günlük sayım",
        records: "Sayım Kayıtları",
        
        // Barcode & Scanning
        barcodeScan: "Barkod Okutun",
        barcode: "Barkod",
        barcodePlaceholder: "Barkod okutun veya manuel girin",
        scanBarcode: "Barkod Tara",
        quickScan: "Hızlı Tarama",
        errorBarcode: "Hata: Ürün bilgisi bulunamadı! Lütfen barkodu kontrol edin.",
        invalidBarcode: "Geçersiz barkod",
        productInfo: "Ürün Bilgileri Tespit Edildi",
        
        // Form Fields
        location: "Lokasyon",
        locationInput: "Lokasyon",
        locationPlaceholder: "Raf/Koridor/Bölüm",
        locationDistribution: "Lokasyon Miktar Dağılımı",
        quantity: "Miktar",
        notes: "Notlar",
        optional: "Opsiyonel",
        required: "Zorunlu",
        
        // Actions
        save: "Kaydet",
        update: "Güncelle",
        cancel: "İptal",
        delete: "Sil",
        edit: "Düzenle",
        search: "Ara",
        filter: "Filtrele",
        export: "Dışa Aktar",
        import: "İçe Aktar",
        reset: "Sıfırla",
        clear: "Temizle",
        submit: "Gönder",
        confirm: "Onayla",
        yes: "Evet",
        no: "Hayır",
        
        // Messages
        successTitle: "Başarılı!",
        successCount: "Kayıt başarıyla",
        successAdded: "eklendi",
        successUpdated: "güncellendi",
        successDeleted: "silindi",
        processing: "İşleniyor...",
        loading: "Yükleniyor...",
        saving: "Kaydediliyor...",
        deleting: "Siliniyor...",
        
        // Search & Filter
        searchPlaceholder: "Ürün/Lot/Lokasyon Ara...",
        searchByProduct: "Ürüne Göre Ara",
        searchByLot: "Lote Göre Ara",
        searchByLocation: "Lokasyona Göre Ara",
        filterByCategory: "Kategoriye Göre Filtrele",
        filterByDate: "Tarihe Göre Filtrele",
        allCategories: "Tüm Kategoriler",
        dateFrom: "Başlangıç Tarihi",
        dateTo: "Bitiş Tarihi",
        
        // Sort
        sortBy: "Sırala",
        sortByDate: "Tarihe Göre",
        sortByQuantity: "Miktara Göre",
        sortByProduct: "Ürüne Göre",
        sortByLocation: "Lokasyona Göre",
        sortAscending: "Artan",
        sortDescending: "Azalan",
        
        // Charts & Reports
        charts: "Grafikler",
        reports: "Raporlar",
        generateReport: "Rapor Oluştur",
        downloadReport: "Raporu İndir",
        printReport: "Raporu Yazdır",
        noChartData: "Görselleştirilecek veri yok.",
        
        // Export
        erpExport: "ERP'ye Aktar",
        erpExportInfo: "Aktar ve kayıtları temizle",
        erpExportAuth: "Yetki Gerekiyor (Depo Müdürü)",
        exportPDF: "PDF Olarak Dışa Aktar",
        exportExcel: "Excel Olarak Dışa Aktar",
        exportCSV: "CSV Olarak Dışa Aktar",
        exportConfirm: "Dikkat: {warehouseName} deposundaki {count} adet sayım kaydı ERP'ye aktarıldıktan sonra SİLİNECEKTİR. Emin misiniz?",
        exportNoData: "Aktarılacak sayım kaydı bulunmamaktadır!",
        exportSuccessTitle: "Aktarım Başarılı!",
        exportSuccessText: "Rapor başarıyla dışa aktarıldı ve sayım kayıtları temizlendi.",
        
        // Settings
        settings: "Ayarlar",
        preferences: "Tercihler",
        language: "Dil",
        theme: "Tema",
        lightMode: "Aydınlık Mod",
        darkMode: "Karanlık Mod",
        languageSelect: "Dil Seçimi",
        
        // Tips & Help
        tipsHeader: "Hızlı İpuçları",
        tip1: "rolü ile kayıt yapıyorsunuz.",
        tip2: "Barkod okuyucu ile barkodu okutun, miktar ve lokasyonu girerek hızlıca kaydedin.",
        tip3: "Lütfen miktar alanı için pozitif bir tam sayı girin.",
        tip4: "Sistem hızlı tarama için optimize edilmiştir.",
        tip5: "QR kod desteği ile daha hızlı işlem yapabilirsiniz.",
        
        // Validation
        requiredFields: "Lütfen miktar ve lokasyon bilgilerini girin!",
        invalidQuantity: "Geçersiz miktar",
        invalidLocation: "Geçersiz lokasyon",
        positiveInteger: "pozitif tam sayı",
        
        // Notifications
        undoNotification: " silindi.",
        undoButton: "Geri Al",
        noRecords: "Henüz sayım kaydı bulunmamaktadır",
        noFilterRecords: "Arama/filtre kriterlerine uygun kayıt bulunamadı",
        noAuth: "Yetki Yok",
        
        // Date & Time
        date: "Tarih",
        time: "Saat",
        updated: "Güncellendi",
        created: "Oluşturuldu",
        user: "Kullanıcı",
        
        // Permissions
        permission: "Yetki",
        permissions: "Yetkiler",
        viewOnly: "Sadece Görüntüle",
        canEdit: "Düzenleyebilir",
        canDelete: "Silebilir",
        canExport: "Dışa Aktarabilir",
        canManageUsers: "Kullanıcı Yönetebilir",
        
        // Error Messages
        error: "Hata",
        errorOccurred: "Bir hata oluştu",
        tryAgain: "Tekrar Dene",
        connectionError: "Bağlantı hatası",
        notFound: "Bulunamadı",
        
        // General
        general: "Genel",
        details: "Detaylar",
        close: "Kapat",
        back: "Geri",
        next: "İleri",
        previous: "Önceki",
        finish: "Bitir",
        continue: "Devam Et",
        skip: "Atla",
        info: "Bilgi",
        warning: "Uyarı",
        error: "Hata",
        
        // Statistics
        statistics: "İstatistikler",
        total: "Toplam",
        average: "Ortalama",
        maximum: "Maksimum",
        minimum: "Minimum",
        
        // Advanced Features
        advanced: "Gelişmiş",
        batchScan: "Toplu Tarama",
        quickEntry: "Hızlı Giriş",
        recentCounts: "Son Sayımlar",
        favorites: "Favoriler",
        history: "Geçmiş",
        archive: "Arşiv"
    },
    
    en: {
        // App Info
        appTitle: "Warehouse Inventory System",
        appSubtitle: "Professional Inventory Management",
        edition: "Professional Edition",
        version: "v3.0",
        
        // Auth & Login
        loginHeader: "User Login",
        loginInfo: "Select a user to log in to the system",
        username: "Username",
        password: "Password",
        rememberMe: "Remember Me",
        forgotPassword: "Forgot Password",
        loginButton: "Login",
        logoutButton: "Logout",
        exit: "Logout",
        
        // Dashboard
        dashboard: "Dashboard",
        welcome: "Welcome",
        systemActive: "System Active",
        statusActive: "Active",
        statusMaintenance: "Maintenance",
        capacity: "Capacity Utilization",
        
        // Warehouse
        warehouseSelection: "Warehouse Selection",
        warehouse: "Warehouse",
        warehouses: "Warehouses",
        warehouseName: "Warehouse Name",
        warehouseLocation: "Warehouse Location",
        warehouseCapacity: "Capacity",
        addWarehouse: "Add Warehouse",
        editWarehouse: "Edit Warehouse",
        deleteWarehouse: "Delete Warehouse",
        
        // User Management
        users: "Users",
        addUser: "Add User",
        editUser: "Edit User",
        deleteUser: "Delete User",
        userName: "Username",
        userRole: "Role",
        userPermission: "Permission",
        userStatus: "Status",
        active: "Active",
        inactive: "Inactive",
        admin: "Administrator",
        manager: "Manager",
        employee: "Employee",
        operator: "Operator",
        
        // Product Management
        products: "Products",
        product: "Product",
        productCode: "Product Code",
        productName: "Product Name",
        lotNumber: "Lot Number",
        category: "Category",
        unit: "Unit",
        minStock: "Minimum Stock",
        addProduct: "Add Product",
        editProduct: "Edit Product",
        deleteProduct: "Delete Product",
        
        // Inventory/Count
        newCount: "New Count Record",
        countRecords: "Count Records",
        totalCounts: "Total Counts",
        totalQuantity: "Total Quantity",
        uniqueProducts: "Unique Products",
        today: "Today",
        audit: "All records",
        unitsCounted: "Units counted",
        productVariety: "Product variety",
        dailyCount: "Daily count",
        records: "Count Records",
        
        // Barcode & Scanning
        barcodeScan: "Scan Barcode",
        barcode: "Barcode",
        barcodePlaceholder: "Scan barcode or enter manually",
        scanBarcode: "Scan Barcode",
        quickScan: "Quick Scan",
        errorBarcode: "Error: Product information not found! Please check the barcode.",
        invalidBarcode: "Invalid barcode",
        productInfo: "Product Information Detected",
        
        // Form Fields
        location: "Location",
        locationInput: "Location",
        locationPlaceholder: "Rack/Aisle/Section",
        locationDistribution: "Location Quantity Distribution",
        quantity: "Quantity",
        notes: "Notes",
        optional: "Optional",
        required: "Required",
        
        // Actions
        save: "Save",
        update: "Update",
        cancel: "Cancel",
        delete: "Delete",
        edit: "Edit",
        search: "Search",
        filter: "Filter",
        export: "Export",
        import: "Import",
        reset: "Reset",
        clear: "Clear",
        submit: "Submit",
        confirm: "Confirm",
        yes: "Yes",
        no: "No",
        
        // Messages
        successTitle: "Success!",
        successCount: "Record successfully",
        successAdded: "added",
        successUpdated: "updated",
        successDeleted: "deleted",
        processing: "Processing...",
        loading: "Loading...",
        saving: "Saving...",
        deleting: "Deleting...",
        
        // Search & Filter
        searchPlaceholder: "Search Product/Lot/Location...",
        searchByProduct: "Search by Product",
        searchByLot: "Search by Lot",
        searchByLocation: "Search by Location",
        filterByCategory: "Filter by Category",
        filterByDate: "Filter by Date",
        allCategories: "All Categories",
        dateFrom: "Date From",
        dateTo: "Date To",
        
        // Sort
        sortBy: "Sort By",
        sortByDate: "Sort by Date",
        sortByQuantity: "Sort by Quantity",
        sortByProduct: "Sort by Product",
        sortByLocation: "Sort by Location",
        sortAscending: "Ascending",
        sortDescending: "Descending",
        
        // Charts & Reports
        charts: "Charts",
        reports: "Reports",
        generateReport: "Generate Report",
        downloadReport: "Download Report",
        printReport: "Print Report",
        noChartData: "No data to visualize.",
        
        // Export
        erpExport: "Export to ERP",
        erpExportInfo: "Export and clear records",
        erpExportAuth: "Authorization Required (Warehouse Manager)",
        exportPDF: "Export as PDF",
        exportExcel: "Export as Excel",
        exportCSV: "Export as CSV",
        exportConfirm: "Warning: {count} count records in the {warehouseName} warehouse will be DELETED after exporting to ERP. Are you sure?",
        exportNoData: "No count records to export!",
        exportSuccessTitle: "Export Successful!",
        exportSuccessText: "Report successfully exported and count records cleared.",
        
        // Settings
        settings: "Settings",
        preferences: "Preferences",
        language: "Language",
        theme: "Theme",
        lightMode: "Light Mode",
        darkMode: "Dark Mode",
        languageSelect: "Language Selection",
        
        // Tips & Help
        tipsHeader: "Quick Tips",
        tip1: "role is currently recording.",
        tip2: "Scan the barcode with the reader, enter the quantity and location, and save quickly.",
        tip3: "Please enter a positive integer for the quantity field.",
        tip4: "System is optimized for fast scanning.",
        tip5: "You can work faster with QR code support.",
        
        // Validation
        requiredFields: "Please enter quantity and location information!",
        invalidQuantity: "Invalid quantity",
        invalidLocation: "Invalid location",
        positiveInteger: "positive integer",
        
        // Notifications
        undoNotification: " deleted.",
        undoButton: "Undo",
        noRecords: "No count records found yet",
        noFilterRecords: "No records match the search/filter criteria",
        noAuth: "No Authorization",
        
        // Date & Time
        date: "Date",
        time: "Time",
        updated: "Updated",
        created: "Created",
        user: "User",
        
        // Permissions
        permission: "Permission",
        permissions: "Permissions",
        viewOnly: "View Only",
        canEdit: "Can Edit",
        canDelete: "Can Delete",
        canExport: "Can Export",
        canManageUsers: "Can Manage Users",
        
        // Error Messages
        error: "Error",
        errorOccurred: "An error occurred",
        tryAgain: "Try Again",
        connectionError: "Connection error",
        notFound: "Not Found",
        
        // General
        general: "General",
        details: "Details",
        close: "Close",
        back: "Back",
        next: "Next",
        previous: "Previous",
        finish: "Finish",
        continue: "Continue",
        skip: "Skip",
        info: "Info",
        warning: "Warning",
        error: "Error",
        
        // Statistics
        statistics: "Statistics",
        total: "Total",
        average: "Average",
        maximum: "Maximum",
        minimum: "Minimum",
        
        // Advanced Features
        advanced: "Advanced",
        batchScan: "Batch Scan",
        quickEntry: "Quick Entry",
        recentCounts: "Recent Counts",
        favorites: "Favorites",
        history: "History",
        archive: "Archive"
    },
    
    de: {
        // App Info
        appTitle: "Lagerbestandssystem",
        appSubtitle: "Professionelles Bestandsmanagement",
        edition: "Professionelle Ausgabe",
        version: "v3.0",
        
        // Auth & Login
        loginHeader: "Benutzeranmeldung",
        loginInfo: "Wählen Sie einen Benutzer zum Anmelden aus",
        username: "Benutzername",
        password: "Passwort",
        rememberMe: "Angemeldet bleiben",
        forgotPassword: "Passwort vergessen",
        loginButton: "Anmelden",
        logoutButton: "Abmelden",
        exit: "Abmelden",
        
        // Dashboard
        dashboard: "Dashboard",
        welcome: "Willkommen",
        systemActive: "System Aktiv",
        statusActive: "Aktiv",
        statusMaintenance: "Wartung",
        capacity: "Kapazitätsauslastung",
        
        // Warehouse
        warehouseSelection: "Lagerauswahl",
        warehouse: "Lager",
        warehouses: "Lager",
        warehouseName: "Lager Name",
        warehouseLocation: "Lager Standort",
        warehouseCapacity: "Kapazität",
        addWarehouse: "Lager hinzufügen",
        editWarehouse: "Lager bearbeiten",
        deleteWarehouse: "Lager löschen",
        
        // User Management
        users: "Benutzer",
        addUser: "Benutzer hinzufügen",
        editUser: "Benutzer bearbeiten",
        deleteUser: "Benutzer löschen",
        userName: "Benutzername",
        userRole: "Rolle",
        userPermission: "Berechtigung",
        userStatus: "Status",
        active: "Aktiv",
        inactive: "Inaktiv",
        admin: "Administrator",
        manager: "Manager",
        employee: "Mitarbeiter",
        operator: "Betreiber",
        
        // Product Management
        products: "Produkte",
        product: "Produkt",
        productCode: "Produktcode",
        productName: "Produktname",
        lotNumber: "Losnummer",
        category: "Kategorie",
        unit: "Einheit",
        minStock: "Mindestbestand",
        addProduct: "Produkt hinzufügen",
        editProduct: "Produkt bearbeiten",
        deleteProduct: "Produkt löschen",
        
        // Inventory/Count
        newCount: "Neue Zählung erfassen",
        countRecords: "Zählungsaufzeichnungen",
        totalCounts: "Gesamtzählungen",
        totalQuantity: "Gesamtmenge",
        uniqueProducts: "Einzigartige Produkte",
        today: "Heute",
        audit: "Alle Aufzeichnungen",
        unitsCounted: "Gezählte Einheiten",
        productVariety: "Produktvielfalt",
        dailyCount: "Tägliche Zählung",
        records: "Zählungsaufzeichnungen",
        
        // Barcode & Scanning
        barcodeScan: "Barcode scannen",
        barcode: "Barcode",
        barcodePlaceholder: "Barcode scannen oder manuell eingeben",
        scanBarcode: "Barcode scannen",
        quickScan: "Schnellscannen",
        errorBarcode: "Fehler: Produktinformationen nicht gefunden! Bitte überprüfen Sie den Barcode.",
        invalidBarcode: "Ungültiger Barcode",
        productInfo: "Produktinformationen erkannt",
        
        // Form Fields
        location: "Standort",
        locationInput: "Standort",
        locationPlaceholder: "Regal/Gang/Abschnitt",
        locationDistribution: "Standort Mengenverteilung",
        quantity: "Menge",
        notes: "Notizen",
        optional: "Optional",
        required: "Erforderlich",
        
        // Actions
        save: "Speichern",
        update: "Aktualisieren",
        cancel: "Abbrechen",
        delete: "Löschen",
        edit: "Bearbeiten",
        search: "Suchen",
        filter: "Filtern",
        export: "Exportieren",
        import: "Importieren",
        reset: "Zurücksetzen",
        clear: "Löschen",
        submit: "Senden",
        confirm: "Bestätigen",
        yes: "Ja",
        no: "Nein",
        
        // Messages
        successTitle: "Erfolgreich!",
        successCount: "Datensatz erfolgreich",
        successAdded: "hinzugefügt",
        successUpdated: "aktualisiert",
        successDeleted: "gelöscht",
        processing: "Verarbeitung...",
        loading: "Laden...",
        saving: "Speichern...",
        deleting: "Löschen...",
        
        // Search & Filter
        searchPlaceholder: "Produkt/Los/Standort suchen...",
        searchByProduct: "Nach Produkt suchen",
        searchByLot: "Nach Los suchen",
        searchByLocation: "Nach Standort suchen",
        filterByCategory: "Nach Kategorie filtern",
        filterByDate: "Nach Datum filtern",
        allCategories: "Alle Kategorien",
        dateFrom: "Datum Von",
        dateTo: "Datum Bis",
        
        // Sort
        sortBy: "Sortieren nach",
        sortByDate: "Nach Datum sortieren",
        sortByQuantity: "Nach Menge sortieren",
        sortByProduct: "Nach Produkt sortieren",
        sortByLocation: "Nach Standort sortieren",
        sortAscending: "Aufsteigend",
        sortDescending: "Absteigend",
        
        // Charts & Reports
        charts: "Diagramme",
        reports: "Berichte",
        generateReport: "Bericht erstellen",
        downloadReport: "Bericht herunterladen",
        printReport: "Bericht drucken",
        noChartData: "Keine Daten zum Visualisieren.",
        
        // Export
        erpExport: "Export nach ERP",
        erpExportInfo: "Exportieren und Datensätze löschen",
        erpExportAuth: "Autorisierung erforderlich (Lagerleiter)",
        exportPDF: "Als PDF exportieren",
        exportExcel: "Als Excel exportieren",
        exportCSV: "Als CSV exportieren",
        exportConfirm: "Warnung: {count} Zählungsaufzeichnungen im {warehouseName} Lager werden nach dem Export nach ERP GELÖSCHT. Sind Sie sicher?",
        exportNoData: "Keine Zählungsaufzeichnungen zum Exportieren!",
        exportSuccessTitle: "Export erfolgreich!",
        exportSuccessText: "Bericht erfolgreich exportiert und Zählungsaufzeichnungen gelöscht.",
        
        // Settings
        settings: "Einstellungen",
        preferences: "Einstellungen",
        language: "Sprache",
        theme: "Design",
        lightMode: "Hell Modus",
        darkMode: "Dunkel Modus",
        languageSelect: "Sprachauswahl",
        
        // Tips & Help
        tipsHeader: "Schnelle Tipps",
        tip1: "Rolle zeichnet derzeit auf.",
        tip2: "Scannen Sie den Barcode mit dem Leser, geben Sie die Menge und den Standort ein und speichern Sie schnell.",
        tip3: "Bitte geben Sie eine positive ganze Zahl für das Mengenfeld ein.",
        tip4: "System ist für schnelles Scannen optimiert.",
        tip5: "Sie können mit QR-Code-Unterstützung schneller arbeiten.",
        
        // Validation
        requiredFields: "Bitte geben Sie Mengen- und Standortinformationen ein!",
        invalidQuantity: "Ungültige Menge",
        invalidLocation: "Ungültiger Standort",
        positiveInteger: "positive ganze Zahl",
        
        // Notifications
        undoNotification: " gelöscht.",
        undoButton: "Rückgängig",
        noRecords: "Noch keine Zählungsaufzeichnungen gefunden",
        noFilterRecords: "Keine Aufzeichnungen entsprechen den Such-/Filterkriterien",
        noAuth: "Keine Berechtigung",
        
        // Date & Time
        date: "Datum",
        time: "Zeit",
        updated: "Aktualisiert",
        created: "Erstellt",
        user: "Benutzer",
        
        // Permissions
        permission: "Berechtigung",
        permissions: "Berechtigungen",
        viewOnly: "Nur Anzeigen",
        canEdit: "Kann bearbeiten",
        canDelete: "Kann löschen",
        canExport: "Kann exportieren",
        canManageUsers: "Kann Benutzer verwalten",
        
        // Error Messages
        error: "Fehler",
        errorOccurred: "Ein Fehler ist aufgetreten",
        tryAgain: "Erneut versuchen",
        connectionError: "Verbindungsfehler",
        notFound: "Nicht gefunden",
        
        // General
        general: "Allgemein",
        details: "Details",
        close: "Schließen",
        back: "Zurück",
        next: "Weiter",
        previous: "Vorherige",
        finish: "Fertig",
        continue: "Fortsetzen",
        skip: "Überspringen",
        info: "Info",
        warning: "Warnung",
        error: "Fehler",
        
        // Statistics
        statistics: "Statistiken",
        total: "Gesamt",
        average: "Durchschnitt",
        maximum: "Maximum",
        minimum: "Minimum",
        
        // Advanced Features
        advanced: "Erweitert",
        batchScan: "Stapelscan",
        quickEntry: "Schnelleingabe",
        recentCounts: "Letzte Zählungen",
        favorites: "Favoriten",
        history: "Verlauf",
        archive: "Archiv"
    }
};

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TRANSLATIONS;
}

