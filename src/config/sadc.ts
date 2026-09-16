export const SADC_COUNTRIES = [
  'Angola',
  'Botswana',
  'Comoros',
  'Democratic Republic of the Congo',
  'Eswatini',
  'Lesotho',
  'Madagascar',
  'Malawi',
  'Mauritius',
  'Mozambique',
  'Namibia',
  'Seychelles',
  'South Africa',
  'Tanzania',
  'Zambia',
  'Zimbabwe',
] as const

export const SADC_PROVINCES: Record<string, string[]> = {
  Angola: ['Bengo', 'Benguela', 'Bié', 'Cabinda', 'Cuando Cubango', 'Cuanza Norte', 'Cuanza Sul', 'Cunene', 'Huambo', 'Huíla', 'Luanda', 'Lunda Norte', 'Lunda Sul', 'Malanje', 'Moxico', 'Namibe', 'Uíge', 'Zaire'],
  Botswana: ['Central', 'Chobe', 'Gaborone', 'Ghanzi', 'Kgalagadi', 'Kgatleng', 'Kweneng', 'North East', 'North West', 'Southern'],
  Comoros: ['Grande Comore', 'Mohéli', 'Anjouan'],
  'Democratic Republic of the Congo': ['Kinshasa', 'Kongo Central', 'Kwango', 'Kwilu', 'Mai-Ndombe', 'Kasai', 'Kasai Central', 'Kasai Oriental', 'Lomami', 'Sankuru', 'Maniema', 'South Kivu', 'North Kivu', 'Ituri', 'Haut-Uele', 'Bas-Uele', 'Tshopo', 'Mongala', 'North Ubangi', 'South Ubangi', 'Equateur', 'Tanganyika', 'Haut-Lomami', 'Lualaba', 'Haut-Katanga'],
  Eswatini: ['Hhohho', 'Lubombo', 'Manzini', 'Shiselweni'],
  Lesotho: ['Berea', 'Butha-Buthe', 'Leribe', 'Mafeteng', 'Maseru', 'Mohale’s Hoek', 'Mokhotlong', 'Qacha’s Nek', 'Quthing', 'Thaba-Tseka'],
  Madagascar: ['Antananarivo', 'Antsiranana', 'Fianarantsoa', 'Mahajanga', 'Toamasina', 'Toliara'],
  Malawi: ['Central Region', 'Northern Region', 'Southern Region'],
  Mauritius: ['Black River', 'Flacq', 'Grand Port', 'Moka', 'Pamplemousses', 'Plaines Wilhems', 'Port Louis', 'Rivière du Rempart', 'Savanne'],
  Mozambique: ['Cabo Delgado', 'Gaza', 'Inhambane', 'Manica', 'Maputo', 'Maputo City', 'Nampula', 'Niassa', 'Sofala', 'Tete', 'Zambezia'],
  Namibia: ['Erongo', 'Hardap', '//Karas', 'Kavango East', 'Kavango West', 'Khomas', 'Kunene', 'Ohangwena', 'Omaheke', 'Omusati', 'Oshana', 'Oshikoto', 'Otjozondjupa', 'Zambezi'],
  Seychelles: ['Mahé', 'Praslin', 'La Digue'],
  'South Africa': ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape'],
  Tanzania: ['Arusha', 'Dar es Salaam', 'Dodoma', 'Geita', 'Iringa', 'Kagera', 'Katavi', 'Kigoma', 'Kilimanjaro', 'Lindi', 'Manyara', 'Mara', 'Mbeya', 'Morogoro', 'Mtwara', 'Mwanza', 'Njombe', 'Pemba North', 'Pemba South', 'Pwani', 'Rukwa', 'Ruvuma', 'Shinyanga', 'Simiyu', 'Singida', 'Songwe', 'Tabora', 'Tanga', 'Zanzibar North', 'Zanzibar South and Central', 'Zanzibar West'],
  Zambia: ['Central', 'Copperbelt', 'Eastern', 'Luapula', 'Lusaka', 'Muchinga', 'Northern', 'North-Western', 'Southern', 'Western'],
  Zimbabwe: ['Bulawayo', 'Harare', 'Manicaland', 'Mashonaland Central', 'Mashonaland East', 'Mashonaland West', 'Masvingo', 'Matabeleland North', 'Matabeleland South', 'Midlands'],
}

export const provincesForCountry = (country: string) => SADC_PROVINCES[country] || []
