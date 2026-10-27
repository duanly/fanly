import 'dio_client.dart';

/// 接口封装。与 h5/src/api/index.js 的用户端 api 一一对应。
/// 阶段 0 先放认证/个人资料；后续阶段逐步补齐购物、资金、客服等。
class Api {
  final _c = DioClient.instance;

  // ── 认证 ──
  Future<Map<String, dynamic>> login(String mobile, String password) async {
    final r = await _c.post('/api/auth/login', data: {
      'mobile': mobile,
      'password': password,
    });
    return Map<String, dynamic>.from(r as Map);
  }

  Future<Map<String, dynamic>> register({
    required String mobile,
    required String password,
    required String captcha, // 图形验证码
    required String captchaKey,
    required String smsCode,
    String? inviteCode,
  }) async {
    final r = await _c.post('/api/auth/register', data: {
      'mobile': mobile,
      'password': password,
      'captcha': captcha,
      'captchaKey': captchaKey,
      'smsCode': smsCode,
      if (inviteCode != null && inviteCode.isNotEmpty) 'inviteCode': inviteCode,
    });
    return Map<String, dynamic>.from(r as Map);
  }

  /// 发送注册短信验证码
  Future<void> sendSms(String mobile) =>
      _c.post('/api/auth/sms', data: {'mobile': mobile});

  /// 图形验证码：{ key, svg }
  Future<Map<String, dynamic>> captcha() async {
    final r = await _c.get('/api/auth/captcha');
    return Map<String, dynamic>.from(r as Map);
  }

  Future<Map<String, dynamic>> changePassword({
    required String oldPassword,
    required String newPassword,
  }) async {
    final r = await _c.post('/api/auth/password', data: {
      'oldPassword': oldPassword,
      'newPassword': newPassword,
    });
    return Map<String, dynamic>.from(r as Map);
  }

  Future<Map<String, dynamic>> profile() async {
    final r = await _c.get('/api/auth/profile');
    return Map<String, dynamic>.from(r as Map);
  }

  // ── 首页配置 ──
  Future<List<Map<String, dynamic>>> homeLinks(String slot) async {
    final r = await _c.get('/api/home/links', params: {'slot': slot});
    return (r as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<List<Map<String, dynamic>>> topics() async {
    final r = await _c.get('/api/topics');
    final list = (r is List ? r : (r as Map)['list']) as List? ?? [];
    return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  // ── 榜单：热销/返利/推荐（返回 { list, page, pageSize, hasMore }）──
  Future<Map<String, dynamic>> ranking(String type, {
    int page = 1,
    int pageSize = 20,
    String? sortBy,
  }) async {
    final r = await _c.get('/api/home/ranking', params: {
      'type': type,
      'page': page,
      'pageSize': pageSize,
      if (sortBy != null) 'sortBy': sortBy,
    });
    return Map<String, dynamic>.from(r as Map);
  }

  // ── 商品搜索（选品池）──
  Future<Map<String, dynamic>> searchGoods({
    String platform = 'ALL',
    String keyword = '',
    int page = 1,
    int pageSize = 20,
  }) async {
    final r = await _c.get('/api/goods/search', params: {
      'platform': platform,
      'keyword': keyword,
      'page': page,
      'pageSize': pageSize,
    });
    return Map<String, dynamic>.from(r as Map);
  }

  // ── 商品详情（null 表示选品池没有/已下架）──
  Future<Map<String, dynamic>?> goodsDetail(String platform, String goodsId) async {
    final r = await _c.get('/api/goods/$platform/$goodsId');
    if (r == null) return null;
    return Map<String, dynamic>.from(r as Map);
  }

  // ── 转链：返回 shortUrl/deeplink/password 等 ──
  Future<Map<String, dynamic>> convert(String platform, String goodsId) async {
    final r = await _c.post('/api/link/convert', data: {
      'platform': platform,
      'goodsId': goodsId,
    });
    return Map<String, dynamic>.from(r as Map);
  }

  // ── 平台授权状态（拼多多推广位备案）──
  Future<Map<String, dynamic>> authzStatus(String platform) async {
    final r = await _c.get('/api/authz/status', params: {'platform': platform});
    return Map<String, dynamic>.from(r as Map);
  }

  Future<Map<String, dynamic>> authzUrl(String platform) async {
    final r = await _c.get('/api/authz/url', params: {'platform': platform});
    return Map<String, dynamic>.from(r as Map);
  }
}

final api = Api();
