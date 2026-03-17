export interface Location {
  name: string;
  lat: number;
  lng: number;
}

export interface StateData {
  name: string;
  districts: Location[];
}

export const indianStates: StateData[] = [
  {
    name: "Andaman and Nicobar Islands",
    districts: [
      { name: "Port Blair", lat: 11.6234, lng: 92.7265 },
      { name: "Car Nicobar", lat: 9.1667, lng: 92.7667 }
    ]
  },
  {
    name: "Andhra Pradesh",
    districts: [
      { name: "Visakhapatnam", lat: 17.6868, lng: 83.2185 },
      { name: "Vijayawada", lat: 16.5062, lng: 80.6480 },
      { name: "Guntur", lat: 16.3067, lng: 80.4365 },
      { name: "Nellore", lat: 14.4426, lng: 79.9865 },
      { name: "Tirupati", lat: 13.6288, lng: 79.4192 },
      { name: "Kurnool", lat: 15.8281, lng: 78.0373 }
    ]
  },
  {
    name: "Arunachal Pradesh",
    districts: [
      { name: "Itanagar", lat: 27.0844, lng: 93.6053 },
      { name: "Tawang", lat: 27.5861, lng: 91.8661 },
      { name: "Pasighat", lat: 28.0619, lng: 95.3260 }
    ]
  },
  {
    name: "Assam",
    districts: [
      { name: "Guwahati", lat: 26.1445, lng: 91.7362 },
      { name: "Dibrugarh", lat: 27.4728, lng: 94.9120 },
      { name: "Silchar", lat: 24.8333, lng: 92.7789 },
      { name: "Jorhat", lat: 26.7509, lng: 94.2037 }
    ]
  },
  {
    name: "Bihar",
    districts: [
      { name: "Patna", lat: 25.5941, lng: 85.1376 },
      { name: "Gaya", lat: 24.7914, lng: 85.0002 },
      { name: "Muzaffarpur", lat: 26.1209, lng: 85.3647 },
      { name: "Bhagalpur", lat: 25.2425, lng: 86.9842 },
      { name: "Purnia", lat: 25.7771, lng: 87.4753 }
    ]
  },
  {
    name: "Chandigarh",
    districts: [
      { name: "Chandigarh", lat: 30.7333, lng: 76.7794 }
    ]
  },
  {
    name: "Chhattisgarh",
    districts: [
      { name: "Raipur", lat: 21.2514, lng: 81.6296 },
      { name: "Bhilai", lat: 21.1938, lng: 81.3509 },
      { name: "Bilaspur", lat: 22.0797, lng: 82.1391 },
      { name: "Korba", lat: 22.3595, lng: 82.6800 }
    ]
  },
  {
    name: "Dadra and Nagar Haveli and Daman and Diu",
    districts: [
      { name: "Daman", lat: 20.3974, lng: 72.8328 },
      { name: "Diu", lat: 20.7144, lng: 70.9874 },
      { name: "Silvassa", lat: 20.2736, lng: 73.0159 }
    ]
  },
  {
    name: "Delhi",
    districts: [
      { name: "New Delhi", lat: 28.6139, lng: 77.2090 },
      { name: "North Delhi", lat: 28.6946, lng: 77.1683 },
      { name: "South Delhi", lat: 28.4962, lng: 77.2005 },
      { name: "East Delhi", lat: 28.6299, lng: 77.2941 },
      { name: "Dwarka", lat: 28.5823, lng: 77.0500 }
    ]
  },
  {
    name: "Goa",
    districts: [
      { name: "Panaji", lat: 15.4909, lng: 73.8278 },
      { name: "Margao", lat: 15.2736, lng: 73.9580 },
      { name: "Vasco da Gama", lat: 15.3981, lng: 73.8111 }
    ]
  },
  {
    name: "Gujarat",
    districts: [
      { name: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
      { name: "Surat", lat: 21.1702, lng: 72.8311 },
      { name: "Vadodara", lat: 22.3072, lng: 73.1812 },
      { name: "Rajkot", lat: 22.3039, lng: 70.8022 },
      { name: "Gandhinagar", lat: 23.2156, lng: 72.6369 }
    ]
  },
  {
    name: "Haryana",
    districts: [
      { name: "Gurugram", lat: 28.4595, lng: 77.0266 },
      { name: "Faridabad", lat: 28.4089, lng: 77.3178 },
      { name: "Panipat", lat: 29.3909, lng: 76.9635 },
      { name: "Ambala", lat: 30.3782, lng: 76.7767 },
      { name: "Rohtak", lat: 28.8955, lng: 76.5833 }
    ]
  },
  {
    name: "Himachal Pradesh",
    districts: [
      { name: "Shimla", lat: 31.1048, lng: 77.1734 },
      { name: "Dharamshala", lat: 32.2190, lng: 76.3234 },
      { name: "Manali", lat: 32.2396, lng: 77.1887 },
      { name: "Mandi", lat: 31.5892, lng: 76.9319 }
    ]
  },
  {
    name: "Jammu and Kashmir",
    districts: [
      { name: "Srinagar", lat: 34.0837, lng: 74.7973 },
      { name: "Jammu", lat: 32.7266, lng: 74.8570 },
      { name: "Anantnag", lat: 33.7311, lng: 75.1487 },
      { name: "Baramulla", lat: 34.2016, lng: 74.3439 }
    ]
  },
  {
    name: "Jharkhand",
    districts: [
      { name: "Ranchi", lat: 23.3441, lng: 85.3096 },
      { name: "Jamshedpur", lat: 22.8046, lng: 86.2029 },
      { name: "Dhanbad", lat: 23.7957, lng: 86.4304 },
      { name: "Bokaro", lat: 23.6693, lng: 86.1511 }
    ]
  },
  {
    name: "Karnataka",
    districts: [
      { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
      { name: "Mysuru", lat: 12.2958, lng: 76.6394 },
      { name: "Mangaluru", lat: 12.9141, lng: 74.8560 },
      { name: "Hubballi", lat: 15.3647, lng: 75.1240 },
      { name: "Dharwad", lat: 15.4589, lng: 75.0078 },
      { name: "Belagavi", lat: 15.8497, lng: 74.4977 },
      { name: "Kalaburagi (Gulbarga)", lat: 17.3297, lng: 76.8343 },
      { name: "Vijayapura (Bijapur)", lat: 16.8302, lng: 75.7100 },
      { name: "Ballari", lat: 15.1394, lng: 76.9214 },
      { name: "Tumakuru", lat: 13.3392, lng: 77.1016 },
      { name: "Udupi", lat: 13.3409, lng: 74.7421 },
      { name: "Shivamogga", lat: 13.9299, lng: 75.5681 },
      { name: "Davanagere", lat: 14.4644, lng: 75.9218 },
      { name: "Raichur", lat: 16.2076, lng: 77.3616 },
      { name: "Bidar", lat: 17.9104, lng: 77.5199 },
      { name: "Hassan", lat: 13.0070, lng: 76.1032 },
      { name: "Chitradurga", lat: 14.2251, lng: 76.3980 },
      { name: "Kolar", lat: 13.1367, lng: 78.1292 },
      { name: "Mandya", lat: 12.5218, lng: 76.8951 },
      { name: "Chikkamagaluru", lat: 13.3161, lng: 75.7720 },
      { name: "Chikkaballapur", lat: 13.4325, lng: 77.7275 },
      { name: "Ramanagara", lat: 12.7150, lng: 77.2813 },
      { name: "Madikeri (Kodagu)", lat: 12.4244, lng: 75.7382 },
      { name: "Chamarajanagar", lat: 11.9261, lng: 76.9400 },
      { name: "Koppal", lat: 15.3484, lng: 76.1554 },
      { name: "Haveri", lat: 14.7950, lng: 75.4011 },
      { name: "Gadag", lat: 15.4310, lng: 75.6355 },
      { name: "Yadgir", lat: 16.7661, lng: 77.1408 },
      { name: "Bagalkot", lat: 16.1817, lng: 75.6958 },
      { name: "Karwar", lat: 14.8050, lng: 74.1311 },
      { name: "Hosapete (Vijayanagara)", lat: 15.2758, lng: 76.3888 },
      { name: "Gokarna", lat: 14.5500, lng: 74.3167 },
      { name: "Sirsi", lat: 14.6195, lng: 74.8354 },
      { name: "Bhatkal", lat: 13.9789, lng: 74.5599 },
      { name: "Puttur", lat: 12.7663, lng: 75.2016 }
    ]
  },
  {
    name: "Kerala",
    districts: [
      { name: "Thiruvananthapuram", lat: 8.5241, lng: 76.9366 },
      { name: "Kochi", lat: 9.9312, lng: 76.2673 },
      { name: "Kozhikode", lat: 11.2588, lng: 75.7804 },
      { name: "Thrissur", lat: 10.5276, lng: 76.2144 },
      { name: "Kollam", lat: 8.8932, lng: 76.6141 }
    ]
  },
  {
    name: "Ladakh",
    districts: [
      { name: "Leh", lat: 34.1526, lng: 77.5771 },
      { name: "Kargil", lat: 34.5539, lng: 76.1349 }
    ]
  },
  {
    name: "Lakshadweep",
    districts: [
      { name: "Kavaratti", lat: 10.5667, lng: 72.6167 },
      { name: "Minicoy", lat: 8.2833, lng: 73.0500 }
    ]
  },
  {
    name: "Madhya Pradesh",
    districts: [
      { name: "Bhopal", lat: 23.2599, lng: 77.4126 },
      { name: "Indore", lat: 22.7196, lng: 75.8577 },
      { name: "Jabalpur", lat: 23.1815, lng: 79.9864 },
      { name: "Gwalior", lat: 26.2183, lng: 78.1828 },
      { name: "Ujjain", lat: 23.1765, lng: 75.7885 }
    ]
  },
  {
    name: "Maharashtra",
    districts: [
      { name: "Mumbai", lat: 19.0760, lng: 72.8777 },
      { name: "Pune", lat: 18.5204, lng: 73.8567 },
      { name: "Nagpur", lat: 21.1458, lng: 79.0882 },
      { name: "Nashik", lat: 20.0110, lng: 73.7903 },
      { name: "Aurangabad", lat: 19.8762, lng: 75.3433 }
    ]
  },
  {
    name: "Manipur",
    districts: [
      { name: "Imphal", lat: 24.8170, lng: 93.9368 },
      { name: "Churachandpur", lat: 24.3312, lng: 93.6826 }
    ]
  },
  {
    name: "Meghalaya",
    districts: [
      { name: "Shillong", lat: 25.5788, lng: 91.8933 },
      { name: "Tura", lat: 25.5126, lng: 90.2030 }
    ]
  },
  {
    name: "Mizoram",
    districts: [
      { name: "Aizawl", lat: 23.7307, lng: 92.7173 },
      { name: "Lunglei", lat: 22.8833, lng: 92.7333 }
    ]
  },
  {
    name: "Nagaland",
    districts: [
      { name: "Kohima", lat: 25.6751, lng: 94.1086 },
      { name: "Dimapur", lat: 25.8920, lng: 93.7265 }
    ]
  },
  {
    name: "Odisha",
    districts: [
      { name: "Bhubaneswar", lat: 20.2961, lng: 85.8245 },
      { name: "Cuttack", lat: 20.4625, lng: 85.8830 },
      { name: "Rourkela", lat: 22.2604, lng: 84.8536 },
      { name: "Puri", lat: 19.8135, lng: 85.8312 },
      { name: "Berhampur", lat: 19.3150, lng: 84.7941 }
    ]
  },
  {
    name: "Puducherry",
    districts: [
      { name: "Puducherry", lat: 11.9416, lng: 79.8083 },
      { name: "Auroville", lat: 12.0070, lng: 79.8105 },
      { name: "Karaikal", lat: 10.9254, lng: 79.8380 }
    ]
  },
  {
    name: "Punjab",
    districts: [
      { name: "Ludhiana", lat: 30.9010, lng: 75.8573 },
      { name: "Amritsar", lat: 31.6340, lng: 74.8723 },
      { name: "Jalandhar", lat: 31.3260, lng: 75.5762 },
      { name: "Patiala", lat: 30.3398, lng: 76.3869 },
      { name: "Bathinda", lat: 30.2110, lng: 74.9455 }
    ]
  },
  {
    name: "Rajasthan",
    districts: [
      { name: "Jaipur", lat: 26.9124, lng: 75.7873 },
      { name: "Jodhpur", lat: 26.2389, lng: 73.0243 },
      { name: "Udaipur", lat: 24.5854, lng: 73.7125 },
      { name: "Kota", lat: 25.2138, lng: 75.8648 },
      { name: "Ajmer", lat: 26.4499, lng: 74.6399 }
    ]
  },
  {
    name: "Sikkim",
    districts: [
      { name: "Gangtok", lat: 27.3314, lng: 88.6138 },
      { name: "Namchi", lat: 27.1672, lng: 88.3564 }
    ]
  },
  {
    name: "Tamil Nadu",
    districts: [
      { name: "Chennai", lat: 13.0827, lng: 80.2707 },
      { name: "Coimbatore", lat: 11.0168, lng: 76.9558 },
      { name: "Madurai", lat: 9.9252, lng: 78.1198 },
      { name: "Tiruchirappalli", lat: 10.7905, lng: 78.7047 },
      { name: "Salem", lat: 11.6643, lng: 78.1460 }
    ]
  },
  {
    name: "Telangana",
    districts: [
      { name: "Hyderabad", lat: 17.3850, lng: 78.4867 },
      { name: "Warangal", lat: 17.9689, lng: 79.5941 },
      { name: "Nizamabad", lat: 18.6705, lng: 78.0941 },
      { name: "Karimnagar", lat: 18.4386, lng: 79.1288 },
      { name: "Khammam", lat: 17.2473, lng: 80.1514 }
    ]
  },
  {
    name: "Tripura",
    districts: [
      { name: "Agartala", lat: 23.8315, lng: 91.2868 },
      { name: "Udaipur", lat: 23.5354, lng: 91.4820 }
    ]
  },
  {
    name: "Uttar Pradesh",
    districts: [
      { name: "Lucknow", lat: 26.8467, lng: 80.9462 },
      { name: "Kanpur", lat: 26.4499, lng: 80.3319 },
      { name: "Agra", lat: 27.1767, lng: 78.0081 },
      { name: "Varanasi", lat: 25.3176, lng: 82.9739 },
      { name: "Noida", lat: 28.5355, lng: 77.3910 }
    ]
  },
  {
    name: "Uttarakhand",
    districts: [
      { name: "Dehradun", lat: 30.3165, lng: 78.0322 },
      { name: "Haridwar", lat: 29.9457, lng: 78.1642 },
      { name: "Roorkee", lat: 29.8543, lng: 77.8880 },
      { name: "Haldwani", lat: 29.2183, lng: 79.5130 },
      { name: "Nainital", lat: 29.3919, lng: 79.4542 }
    ]
  },
  {
    name: "West Bengal",
    districts: [
      { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
      { name: "Howrah", lat: 22.5958, lng: 88.2636 },
      { name: "Darjeeling", lat: 27.0360, lng: 88.2627 },
      { name: "Siliguri", lat: 26.7271, lng: 88.3953 },
      { name: "Asansol", lat: 23.6739, lng: 86.9524 }
    ]
  }
];