import axios from "axios";
import https from "https";

// Configuración global de Axios
const apiClient = axios.create({
  baseURL: process.env.API_URL ?? "https://localhost:5001",
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
  timeout: 10000,
});

// Configuración global de Axios
const apiClientReports = axios.create({
  baseURL: process.env.API_REPORT_URL ?? "https://localhost:5001",
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
  timeout: 10000,
});

// Configuración global de Axios
const apiClientBalance = axios.create({
  baseURL: process.env.API_BALANCE_URL ?? "https://localhost:5001",
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
  timeout: 10000,
});

// URL base de la API (obtener desde variables de entorno)
const API_BASE_URL = process.env.API_URL || "https://api.empresa.com";

// Clase de servicio API
export class ApiService {
  /**
   * Valida si un número de teléfono corresponde a un vendedor registrado
   * @param phone Número de teléfono del vendedor
   * @returns Datos del vendedor o null si no existe
   */
  static async validateSeller(phone: string): Promise<any> {
    try {
      // Eliminar el "+" inicial si existe y otros caracteres no numéricos
      const cleanPhone = phone.replace(/\D/g, "");
      console.log("Validando vendedor con teléfono limpio:", cleanPhone);
      
      const response = await axios.post(`${API_BASE_URL}/api/DataSellers/ValidateSeller?phone=${cleanPhone}`);
      
      if (response.status === 200 && response.data) {
        console.log("Vendedor validado correctamente");
        return response.data;
      }
      
      console.log("Vendedor no encontrado o no válido");
      return null;
    } catch (error) {
      console.error("Error validando vendedor:", error);
      return null;
    }
  }

  /**
   * Busca clientes por nombre o código
   * @param searchTerm Término de búsqueda
   * @returns Listado de clientes que coinciden con la búsqueda
   */
  static async searchClients(searchTerm: string): Promise<any> {
    try {
      console.log("Buscando clientes con término:", searchTerm);
      const response = await axios.get(`${API_BASE_URL}/api/DataSellers/GetSearchClients?searchTerm=${searchTerm}`, {
        params: { term: searchTerm }
      });
      
      return response.data;
    } catch (error) {
      console.error("Error buscando clientes:", error);
      throw error;
    }
  }

  /**
   * Obtiene el estado de cuenta de un cliente para una empresa específica
   * @param sellerCode Código del vendedor
   * @param company Empresa (Fertica/Cadelga)
   * @param clientCode Código del cliente
   * @returns Estado de cuenta en formato PDF (base64)
   */
  static async getClientAccountStatement(sellerCode: string, company: string, clientCode: string): Promise<any> {
    try {
      console.log(`Obteniendo estado de cuenta: Vendedor ${sellerCode}, Empresa ${company}, Cliente ${clientCode}`);
      
      const response = await axios.post(`${API_BASE_URL}/clients/account-statement`, {
        sellerCode,
        company,
        clientCode
      });
      
      return response.data;
    } catch (error) {
      console.error("Error obteniendo estado de cuenta:", error);
      throw error;
    }
  }

  /**
   * Obtiene el reporte de límites de crédito para los clientes de un vendedor
   * @param sellerCode Código del vendedor
   * @param company Empresa (Fertica/Cadelga)
   * @returns Reporte de límites de crédito en formato PDF (base64)
   */
  static async getCreditLimit(sellerCode: string, empresa: string) {
    try {
      console.log("Consultando límites de crédito para la empresa:", empresa);
      // Determinar la URL según la empresa
      let endpoint = "";
      if (empresa.toLowerCase() === "cadelga") {
        endpoint = `LimiteCreditoCad/${sellerCode}`;
      } else if (empresa.toLowerCase() === "fertica") {
        endpoint = `LimiteCreditoFer/${sellerCode}`;
      } else {
        throw new Error("Empresa no válida. Debe ser 'Cadelga' o 'Fertica'");
      }
      
      // Realizar la solicitud a la API
      const response = await apiClientReports.get(endpoint);
      
      // Verificar la respuesta y retornar los datos
      if (response.status === 200 && response.data) {
        // La respuesta contiene el documento en base64
        const responseData = response.data;
        
        // Verificar que la respuesta tenga la estructura esperada
        if (
          responseData.success && 
          responseData.fileName && 
          responseData.contentType && 
          responseData.base64Content
        ) {
          return responseData;
        }
      }
      
      return null;
    } catch (error) {
      console.error(`Error consultando límites de crédito para ${empresa}:`, error);
      return null;
    }
  }
  
  /**
   * Obtiene los datos de metas del vendedor
   * @param sellerCode Código del vendedor
   * @returns Datos de metas y cumplimiento
   */
  static async getSellerGoals(sellerCode: string): Promise<any> {
    try {
      console.log(`Obteniendo metas para vendedor ${sellerCode}`);
      
      const response = await axios.get(`${API_BASE_URL}/sellers/goals/${sellerCode}`);
      
      return response.data;
    } catch (error) {
      console.error("Error obteniendo metas del vendedor:", error);
      throw error;
    }
  }
  
  /**
   * Obtiene datos de ventas recientes del vendedor
   * @param sellerCode Código del vendedor
   * @param period Período a consultar (mes/trimestre/año)
   * @returns Datos de ventas
   */
  static async getRecentSales(sellerCode: string, period: string = "month"): Promise<any> {
    try {
      console.log(`Obteniendo ventas recientes: Vendedor ${sellerCode}, Período ${period}`);
      
      const response = await axios.get(`${API_BASE_URL}/sales/recent`, {
        params: {
          sellerCode,
          period
        }
      });
      
      return response.data;
    } catch (error) {
      console.error("Error obteniendo ventas recientes:", error);
      throw error;
    }
  }

  // Obtener top clientes
  static async getTopCustomerBySeller(sellerCode: string) {
    try {
      console.log("Consultando top clientes para vendedor:", sellerCode);
      const response = await apiClient.post(
        `/api/DataSellers/TopCustomerBySeller?codigo=${sellerCode}`
      );
      console.log(
        "Respuesta de TopCustomerBySeller:",
        JSON.stringify(response.data)
      );
      // Devolvemos la respuesta completa para poder acceder a la estructura anidada
      return response.status === 200 ? response.data : null;
    } catch (error) {
      console.error("Error obteniendo top clientes:", error);
      return null;
    }
  }

  // Obtener top productos
  static async getTopProductBySeller(sellerCode: string) {
    try {
      console.log("Consultando top productos para vendedor:", sellerCode);
      const response = await apiClient.post(
        `/api/DataSellers/TopProductBySeller?codigo=${sellerCode}`
      );
      console.log(
        "Respuesta de TopProductBySeller:",
        JSON.stringify(response.data)
      );
      // Devolvemos la respuesta completa para poder acceder a la estructura anidada
      return response.status === 200 ? response.data : null;
    } catch (error) {
      console.error("Error obteniendo top productos:", error);
      return null;
    }
  }
  // Obtener meta mensual del vendedor
  static async getSalesDayBySeller(sellerCode: string) {
    try {
      const response = await apiClient.post(
        `/api/DataSellers/SalesDayBySeller?codigo=${sellerCode}`
      );
      return response.status === 200 ? response.data : null;
    } catch (error) {
      console.error("Error obteniendo ventas diarias:", error);
      return null;
    }
  }

  // Obtener ventas de los últimos 6 meses
  static async getSalesSixMonthBySeller(sellerCode: string) {
    try {
      const response = await apiClient.post(
        `/api/DataSellers/SalesSixMonthBySeller?codigo=${sellerCode}`
      );
      return response.status === 200 ? response.data : null;
    } catch (error) {
      console.error("Error obteniendo ventas de 6 meses:", error);
      return null;
    }
  }

  // Consultar inventario de productos en tránsito
  static async getTransitProduct(empresa: string) {
    try {
      console.log(
        "Consultando inventario en tránsito para la empresa:",
        empresa
      );
      const endpoint = "" + empresa=='Fertica'?'InventarioTransitoFER/1':'InventarioTransitoCAD/1';
      // Realizar la solicitud a la API
      const response = await apiClientReports.get(endpoint);    
      // Verificar la respuesta y retornar los datos
      if (response.status === 200 && response.data) {
        // La respuesta contiene el documento en base64
        const responseData = response.data;     
        // Verificar que la respuesta tenga la estructura esperada
        if (
          responseData.success && 
          responseData.fileName && 
          responseData.contentType && 
          responseData.base64Content
        ) {
          return responseData;
        }
      }
      return null;
    } catch (error) {
      console.error("Error consultando inventario:", error);
      return null;
    }
  }

  // Obtener estado de cuenta de un cliente
  static async getEstadoCuenta(clientCode: string, empresa: string) {
    try {
      console.log("Consultando estado de cuenta para cliente:", clientCode, "empresa:", empresa);    
      // Determinar la URL según la empresa
      let endpoint = "api/customerbalance/";
      if (empresa.toLowerCase() === "cadelga") {
        endpoint += `${clientCode}/Cadelga`;
      } else if (empresa.toLowerCase() === "fertica") {
        endpoint += `${clientCode}/Fertica`;
      } else {
        throw new Error("Empresa no válida. Debe ser 'Cadelga' o 'Fertica'");
      }    
      // Realizar la solicitud a la API
      const response = await apiClientBalance.get(endpoint);   
      // Verificar la respuesta y retornar los datos
      if (response.status === 200 && response.data) {
        const responseData = response.data;
        
        // Verificar que la respuesta tenga la estructura esperada
        if (
          responseData.fileName
        ) {
          return responseData;
        }
      }   
      return null;
    } catch (error) {
      console.error(`Error consultando estado de cuenta para ${empresa}:`, error);
      return null;
    }
  }

  /**
   * Obtiene el reporte de Cuentas por cobrar para los clientes de un vendedor
   * @param sellerCode Código del vendedor
   * @param company Empresa (Fertica/Cadelga)
   * @returns Reporte de Cuentas por cobrar en formato PDF (base64)
   */
  static async getCuentasPorCobrar(sellerCode: string, empresa: string) {
    try {
      console.log("Consultando Cuentas por cobrar para la empresa:", empresa);
      // Determinar la URL según la empresa
      let endpoint = "";
      if (empresa.toLowerCase() === "cadelga") {
        endpoint = `CuentasPorCobrarPorVendedorCAD/${sellerCode}`;
      } else if (empresa.toLowerCase() === "fertica") {
        endpoint = `CuentasPorCobrarPorVendedorFER/${sellerCode}`;
      } else {
        throw new Error("Empresa no válida. Debe ser 'Cadelga' o 'Fertica'");
      }
      
      // Realizar la solicitud a la API
      const response = await apiClientReports.get(endpoint);
      
      // Verificar la respuesta y retornar los datos
      if (response.status === 200 && response.data) {
        // La respuesta contiene el documento en base64
        const responseData = response.data;
        
        // Verificar que la respuesta tenga la estructura esperada
        if (
          responseData.success && 
          responseData.fileName && 
          responseData.contentType && 
          responseData.base64Content
        ) {
          return responseData;
        }
      }
      
      return null;
    } catch (error) {
      console.error(`Error consultando límites de crédito para ${empresa}:`, error);
      return null;
    }
  }
  
}
