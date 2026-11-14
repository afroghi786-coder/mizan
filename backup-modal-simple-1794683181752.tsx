          {loading ? <ActivityIndicator color="#d4af37" style={{ marginTop: 20 }} /> : (
            <FlatList
              data={filtered}
              keyExtractor={(m: any) => String(m.code || m.id || Math.random())}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={true}
              renderItem={({ item: m, index: i }) => {
                const rowBg = m.status === 'negative' ? (C.isDark ? '#1e293b' : '#f1f5f9') : m.status === 'out' ? (C.isDark ? '#3b1219' : '#fef2f2') : m.status === 'low' ? (C.isDark ? '#3b2a12' : '#fffbeb') : (i % 2 === 0 ? C.cardAlt : 'transparent');
                return (
                  <View style={[s.tblRow, { flexDirection: 'row-reverse', backgroundColor: rowBg, borderRightWidth: 3, borderRightColor: statusColor(m.status) }]}>
                    <Text style={[s.tdCell, { width: 40, fontSize: 12, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>
                    <TouchableOpacity onPress={() => openModelKardex(m)} style={[s.tdCell, { width: 100 }]}><Text style={{ color: '#7c3aed', fontWeight: 'bold', textDecorationLine: 'underline' }}>{m.code}</Text></TouchableOpacity>
                    <Text style={[s.tdCell, { width: 180, fontSize: 12, color: C.text, textAlign: 'right', fontWeight: 'bold' }]} numberOfLines={1}>{m.name}</Text>
                    <Text style={[s.tdCell, { width: 80, fontSize: 12, color: C.text }]}>{fmt(m.bought)}</Text>
                    <Text style={[s.tdCell, { width: 80, fontSize: 12, color: C.text }]}>{fmt(m.sold)}</Text>
                    <Text style={[s.tdCell, { width: 90, fontSize: 12, color: statusColor(m.status), fontWeight: 'bold', fontSize: 15 }]}>{fmt(m.currentQty)}</Text>
                    <Text style={[s.tdCell, { width: 110, fontSize: 12, color: '#0891b2', fontSize: 11 }]}>{fmt(m.unitCost || 0)}</Text>
                    <Text style={[s.tdCell, { width: 130, fontSize: 12, color: '#059669', fontWeight: 'bold', fontSize: 11 }]}>{fmt(m.totalValue || 0)}</Text>
                    <TouchableOpacity onPress={() => openAdjustment(m)} style={[s.tdCell, { width: 110, alignItems: 'center' }]}>
                      <View style={{ backgroundColor: (m.adjustment || 0) === 0 ? '#fef3c7' : (m.adjustment || 0) > 0 ? '#d1fae5' : '#fee2e2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: (m.adjustment || 0) === 0 ? '#f59e0b' : (m.adjustment || 0) > 0 ? '#059669' : '#dc2626', minWidth: 50, alignItems: 'center' }}>
                        <Text style={{ color: (m.adjustment || 0) === 0 ? '#92400e' : (m.adjustment || 0) > 0 ? '#065f46' : '#991b1b', fontSize: 12, fontWeight: 'bold', textAlign: 'center' }}>
                          {(m.adjustment || 0) === 0 ? '➕' : ((m.adjustment || 0) > 0 ? '+' : '') + fmt(m.adjustment)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <Text style={[s.tdCell, { width: 110, fontSize: 12, color: '#64748b', fontSize: 10 }]}>{m.lastSaleDate ? (displayDateOnly ? displayDateOnly(m.lastSaleDate) : m.lastSaleDate.slice(0,10)) : '—'}</Text>
                    <Text style={[s.tdCell, { width: 100, fontSize: 12, color: (m.daysSinceLastSale !== null && m.daysSinceLastSale > 90) ? '#dc2626' : (m.daysSinceLastSale !== null && m.daysSinceLastSale > 60) ? '#f59e0b' : '#059669', fontWeight: 'bold', fontSize: 11 }]}>{m.daysSinceLastSale !== null ? toFaNum(m.daysSinceLastSale) : '—'}</Text>
                    <TouchableOpacity style={{ width: 120, alignItems: 'center', paddingVertical: 4 }} onPress={() => { setEditItem(m); setShelfVal(m.shelf || ''); }}>
                      <View style={{ backgroundColor: '#f0f9ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                        <Text style={{ color: '#075985', fontSize: 11, fontWeight: 'bold' }}>📍 {m.shelf || 'ثبت نشده'}</Text>
                      </View>
                    </TouchableOpacity>
                    <View style={[s.tdCell, { width: 110, alignItems: 'center' }]}>
                      <Text style={{ color: statusColor(m.status), fontSize: 11, fontWeight: 'bold' }}>{statusLabel(m.status)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => openAdjustment(m)} style={[s.tdCell, { width: 40, alignItems: 'center' }]}><Text style={{ fontSize: 18 }}>⚖️</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => { setEditItem(m); setShelfVal(m.shelf || ''); }} style={[s.tdCell, { width: 100, alignItems: 'center' }]}>
                      <View style={{ backgroundColor: '#7c3aed', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}>
                        <EL textKey="📍 قفسه" style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }} />
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          )}

          {/* 🚨 مودال تعدیل اینجا قرار می‌گیرد (خارج از حلقه) */}
          <Modal visible={adjModal} transparent animationType="slide" onRequestClose={() => setAdjModal(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 12 }}>
              {/* محتوای مودال دقیقاً همان محتوای قبلی است */}
              <View style={{ backgroundColor: '#ffffff', borderRadius: 12, maxHeight: '92%', overflow: 'hidden' }}>
                {/* ... بقیه محتوای مودال ... */}
              </View>
            </View>
          </Modal>